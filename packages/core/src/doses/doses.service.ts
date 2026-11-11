import { InjectQueue } from '@nestjs/bullmq';
import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { and, asc, eq, gte, lt, sql } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module.js';
import { doses, medications, members } from '../db/schema.js';
import { AlertsService } from '../alerts/alerts.service.js';
import { PushService } from '../push/push.service.js';
import { StockService } from '../stock/stock.service.js';
import { telemetry } from '../telemetry/telemetry.js';
import { DOSES_QUEUE, doseJobId, type DoseJob } from './doses.queue.js';
import { localDate, localDateTime, localTime, minutesSince, upcomingDoseTimes } from './time.js';

const KEEP_FINISHED = { removeOnComplete: { age: 7 * 24 * 3600 }, removeOnFail: { age: 7 * 24 * 3600 } };

@Injectable()
export class DosesService {
  private readonly logger = new Logger(DosesService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    @InjectQueue(DOSES_QUEUE) private readonly queue: Queue<DoseJob>,
    private readonly push: PushService,
    private readonly alerts: AlertsService,
    private readonly stock: StockService,
    private readonly config: ConfigService,
  ) {}

  /** Hourly safety net, plus one run now. Called by the worker on boot. */
  async schedulePlanner(): Promise<void> {
    await this.queue.upsertJobScheduler(
      'plan-doses',
      { every: 60 * 60 * 1000 },
      { name: 'plan', data: { kind: 'plan' } },
    );
    await this.queue.add('plan', { kind: 'plan' }, KEEP_FINISHED);
  }

  /** Creates the doses of the next two local days for every medication. */
  async planAll(now = new Date()): Promise<void> {
    const meds = await this.db.select({ id: medications.id }).from(medications);
    for (const med of meds) await this.scheduleForMedication(med.id, now);
  }

  /** Creates the upcoming doses of one medication and queues their reminders. Safe to call again. */
  async scheduleForMedication(medicationId: string, now = new Date()): Promise<void> {
    const [med] = await this.db
      .select({ times: medications.times })
      .from(medications)
      .where(eq(medications.id, medicationId));
    if (!med) throw new NotFoundException('Medicação não encontrada.');

    const times = upcomingDoseTimes(med.times, now);
    if (times.length === 0) return;
    await this.db
      .insert(doses)
      .values(times.map((scheduledAt) => ({ medicationId, scheduledAt })))
      .onConflictDoNothing();

    const upcoming = await this.db
      .select({ id: doses.id, scheduledAt: doses.scheduledAt })
      .from(doses)
      .where(
        and(
          eq(doses.medicationId, medicationId),
          eq(doses.status, 'pending'),
          gte(doses.scheduledAt, now),
        ),
      );
    for (const dose of upcoming) {
      // Same jobId: BullMQ ignores the add if the reminder is already queued.
      await this.queue.add(
        'remind',
        { kind: 'remind', doseId: dose.id },
        {
          jobId: doseJobId('remind', dose.id),
          delay: Math.max(0, dose.scheduledAt.getTime() - now.getTime()),
          ...KEEP_FINISHED,
        },
      );
    }
  }

  /** Push to the patient, then queue the call and the family alert. The demo run passes shorter waits. */
  async remind(doseId: string, waits: { callAfterMs?: number; alertAfterMs?: number } = {}): Promise<void> {
    const dose = await this.getDetails(doseId);
    if (!dose || dose.status !== 'pending') return;

    const delivered = await this.push.sendToMembers([dose.patientId], {
      title: 'Hora do remédio',
      body: `${dose.medicationLabel}. Toque para confirmar que tomou.`,
      url: '/patient',
      doseId,
    });

    telemetry.capture(
      'dose_reminder_sent',
      { dose_id: doseId, channel: 'push', pushes_delivered: delivered, demo: dose.demo },
      dose.patientId,
    );
    this.logger.log(`Reminder for dose ${doseId} sent (${delivered} pushes).`);

    const minute = 60 * 1000;
    const callAfter = waits.callAfterMs ?? this.config.getOrThrow<number>('DOSE_CALL_AFTER_MINUTES') * minute;
    const alertAfter = waits.alertAfterMs ?? this.config.getOrThrow<number>('DOSE_ALERT_AFTER_MINUTES') * minute;
    await this.queue.add(
      'call',
      { kind: 'call', doseId },
      { jobId: doseJobId('call', doseId), delay: callAfter, ...KEEP_FINISHED },
    );
    // Fallback in case the call never reports back. A "no" on the call promotes this job.
    await this.queue.add(
      'alert-family',
      { kind: 'alert-family', doseId },
      { jobId: doseJobId('alert-family', doseId), delay: callAfter + alertAfter, ...KEEP_FINISHED },
    );
  }

  /** Push to the caregivers that the dose was not confirmed. Runs once per dose. */
  async alertFamily(doseId: string): Promise<void> {
    const dose = await this.getDetails(doseId);
    if (!dose || dose.status === 'taken' || dose.familyAlertedAt) return;

    await this.db
      .update(doses)
      .set({ status: 'missed' })
      .where(and(eq(doses.id, doseId), eq(doses.status, 'pending')));

    const { caregivers, sent } = await this.alerts.notifyCaregivers(dose.familyId, {
      kind: 'dose_missed',
      title: `${dose.patientName} não confirmou o remédio`,
      body: `${dose.medicationLabel} das ${localTime(dose.scheduledAt)}. Vale ligar para ${dose.gender === 'male' ? 'ele' : 'ela'}.`,
      url: '/family',
      doseId,
    });
    await this.db.update(doses).set({ familyAlertedAt: new Date() }).where(eq(doses.id, doseId));
    const props = {
      dose_id: doseId,
      minutes_since_scheduled: minutesSince(dose.scheduledAt),
      demo: dose.demo,
    };
    telemetry.capture('dose_missed', props, dose.patientId);
    telemetry.capture('family_alerted', { ...props, caregivers, pushes_delivered: sent }, dose.patientId);
    this.logger.log(`Family alerted for dose ${doseId} (${sent} pushes).`);
  }

  /** "Tomei" in the app. Cancels the call and the family alert. */
  async confirmInApp(doseId: string): Promise<void> {
    const [dose] = await this.db
      .update(doses)
      .set({ status: 'taken', confirmedVia: 'app', confirmedAt: new Date() })
      .where(eq(doses.id, doseId))
      .returning({ id: doses.id });
    if (!dose) throw new NotFoundException('Dose não encontrada.');
    const details = await this.getDetails(doseId);
    if (details) {
      telemetry.capture(
        'dose_confirmed',
        {
          dose_id: doseId,
          via: 'app',
          minutes_since_scheduled: minutesSince(details.scheduledAt),
          demo: details.demo,
        },
        details.patientId,
      );
    }
    this.logger.log(`Dose ${doseId} confirmed in the app.`);
    for (const kind of ['call', 'recall', 'alert-family'] as const) {
      await (await this.queue.getJob(doseJobId(kind, doseId)))?.remove();
    }
    await this.checkStock(doseId);
  }

  /** Low stock alert after a confirmed dose. Never fails the confirmation. */
  async checkStock(doseId: string): Promise<void> {
    try {
      await this.stock.checkAfterDose(doseId);
    } catch (error) {
      telemetry.captureException(error, { step: 'low_stock_check', dose_id: doseId });
      this.logger.error(`Low stock check for dose ${doseId} failed: ${String(error)}`);
    }
  }

  /** Doses of one patient on a local day (today by default). */
  async listForDay(patientId: string, date = localDate(new Date())) {
    const start = localDateTime(date, '00:00');
    if (!start) return [];
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return this.db
      .select({
        id: doses.id,
        scheduledAt: doses.scheduledAt,
        status: doses.status,
        confirmedVia: doses.confirmedVia,
        confirmedAt: doses.confirmedAt,
        familyAlertedAt: doses.familyAlertedAt,
        medicationId: medications.id,
        medicationName: medications.name,
        strength: medications.strength,
      })
      .from(doses)
      .innerJoin(medications, eq(doses.medicationId, medications.id))
      .where(
        and(
          eq(medications.patientId, patientId),
          gte(doses.scheduledAt, start),
          lt(doses.scheduledAt, end),
        ),
      )
      .orderBy(asc(doses.scheduledAt));
  }

  private async getDetails(doseId: string) {
    const [row] = await this.db
      .select({
        status: doses.status,
        scheduledAt: doses.scheduledAt,
        familyAlertedAt: doses.familyAlertedAt,
        demo: doses.demo,
        medicationName: medications.name,
        strength: medications.strength,
        patientId: members.id,
        patientName: sql<string>`coalesce(${members.nickname}, ${members.name})`,
        gender: members.gender,
        familyId: members.familyId,
      })
      .from(doses)
      .innerJoin(medications, eq(doses.medicationId, medications.id))
      .innerJoin(members, eq(medications.patientId, members.id))
      .where(eq(doses.id, doseId));
    if (!row) {
      this.logger.warn(`Dose ${doseId} not found.`);
      return null;
    }
    return {
      ...row,
      medicationLabel: [row.medicationName, row.strength].filter(Boolean).join(' '),
    };
  }
}
