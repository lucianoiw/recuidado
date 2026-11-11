import { InjectQueue } from '@nestjs/bullmq';
import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { and, asc, count, desc, eq, gte, isNotNull, ne, sql } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module.js';
import { doses, families, medications, members, pharmacyInquiries, voiceCalls } from '../db/schema.js';
import { DOSES_QUEUE, doseJobId, type DoseJob } from '../doses/doses.queue.js';
import { AlertsService } from '../alerts/alerts.service.js';
import { DEMO_FAMILY } from '../family/family.service.js';
import { mayContact } from '../privacy/privacy.service.js';
import { StockService } from '../stock/stock.service.js';
import { minutesSince } from '../doses/time.js';
import { telemetry } from '../telemetry/telemetry.js';

/** Body that apps/voice posts to /doses/:id/voice-result. */
export interface VoiceResult {
  sessionId: string;
  outcome: 'confirmed' | 'not_taken' | 'unclear' | 'no_answer' | 'failed';
  confirmed: boolean;
  note?: string | null;
  feelsUnwell?: boolean | null;
  /** Fall, chest pain, shortness of breath or fainting: the caregivers also get a phone call. */
  emergency?: boolean | null;
  /** The call back after an emergency: only how she is now, the dose is left as it was. */
  checkIn?: boolean | null;
  transcript?: { speaker: 'assistant' | 'patient'; text: string }[];
  durationSeconds?: number | null;
  endReason?: string | null;
  error?: string | null;
}

export const alertJobId = (doseId: string) => doseJobId('alert-family', doseId);

@Injectable()
export class VoiceCallService {
  private readonly logger = new Logger(VoiceCallService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    @InjectQueue(DOSES_QUEUE) private readonly queue: Queue<DoseJob>,
    private readonly config: ConfigService,
    private readonly alerts: AlertsService,
    private readonly stock: StockService,
  ) {}

  /**
   * Asks apps/voice to call the patient. Does nothing if the dose is no longer pending.
   * With checkIn, it is the call back after an emergency: the dose status does not matter.
   */
  async call(doseId: string, opts: { checkIn?: boolean } = {}): Promise<{ callId: string } | null> {
    const checkIn = Boolean(opts.checkIn);
    const voiceUrl = this.config.get<string>('VOICE_URL');
    const token = this.config.get<string>('VOICE_API_TOKEN');
    if (!voiceUrl || !token) {
      throw new ServiceUnavailableException('Ligação indisponível: VOICE_URL ou VOICE_API_TOKEN não configurado.');
    }

    const [row] = await this.db
      .select({
        status: doses.status,
        demo: doses.demo,
        patientId: members.id,
        patientName: sql<string>`coalesce(${members.nickname}, ${members.name})`,
        phone: members.phone,
        consentAt: members.consentAt,
        familyId: members.familyId,
        familyName: families.name,
        medication: medications.name,
        strength: medications.strength,
      })
      .from(doses)
      .innerJoin(medications, eq(doses.medicationId, medications.id))
      .innerJoin(members, eq(medications.patientId, members.id))
      .innerJoin(families, eq(members.familyId, families.id))
      .where(eq(doses.id, doseId));
    if (!row) throw new NotFoundException('Dose não encontrada.');
    if (row.status !== 'pending' && !checkIn) {
      this.logger.log(`Dose ${doseId} is ${row.status}; not calling.`);
      return null;
    }
    if (!row.phone) {
      this.logger.warn(`Patient of dose ${doseId} has no phone; not calling.`);
      return null;
    }
    const isDemoFamily = row.familyName === DEMO_FAMILY;
    // The demo phone is a real person's: its daily doses only push, unless DEMO_SCHEDULED_CALLS is on.
    if (isDemoFamily && !row.demo && !this.config.get<boolean>('DEMO_SCHEDULED_CALLS')) {
      telemetry.capture('dose_call_skipped', { dose_id: doseId, reason: 'demo_scheduled' }, row.patientId);
      this.logger.log(`Dose ${doseId} is a scheduled demo dose; push only.`);
      return null;
    }
    if (!mayContact(row.consentAt, row.familyName)) {
      // LGPD: no call before she (or the family for her) agreed. Push and the family alert still work.
      telemetry.capture('dose_call_skipped', { dose_id: doseId, reason: 'no_consent' }, row.patientId);
      this.logger.log(`Patient of dose ${doseId} has not consented; not calling.`);
      return null;
    }
    const overLimit = await this.overCallLimit(row.familyId, isDemoFamily);
    if (overLimit) {
      telemetry.capture('dose_call_skipped', { dose_id: doseId, reason: overLimit }, row.patientId);
      this.logger.warn(`Not calling for dose ${doseId}: ${overLimit}.`);
      return null;
    }

    const res = await fetch(new URL('/calls', voiceUrl), {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        doseId,
        patientId: row.patientId,
        phone: row.phone,
        patientName: row.patientName,
        medications: [{ name: row.medication, dose: row.strength ?? undefined }],
        checkIn,
      }),
    });
    if (res.status === 403) {
      // apps/voice only calls numbers in CALL_ALLOWED_NUMBERS. Push and the family alert still work.
      telemetry.capture('dose_call_skipped', { dose_id: doseId, reason: 'number_not_allowed' }, row.patientId);
      this.logger.log(`Voice refused the number of dose ${doseId}; push only.`);
      return null;
    }
    if (!res.ok) {
      throw new Error(`Voice service answered ${res.status}: ${await res.text()}`);
    }
    if (!checkIn) await this.db.update(doses).set({ callRequestedAt: new Date() }).where(eq(doses.id, doseId));
    const body = (await res.json()) as { callId: string };
    telemetry.capture(
      checkIn ? 'emergency_checkin_requested' : 'dose_call_requested',
      { dose_id: doseId, call_id: body.callId, demo: row.demo },
      row.patientId,
    );
    this.logger.log(`Calling patient of dose ${doseId} (${body.callId}).`);
    return body;
  }

  /**
   * Why a call must not be made now, or null. Counts calls started in the last 24 hours,
   * per family (not the demo family, used by the team and the judges) and in total.
   */
  async overCallLimit(familyId: string, isDemo: boolean, now = new Date()): Promise<string | null> {
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const total = this.config.get<number>('CALL_DAILY_LIMIT_TOTAL') ?? 20;
    // Pharmacy calls (PharmacyService) share the same limits.
    const [all] = await this.db.select({ n: count() }).from(doses).where(gte(doses.callRequestedAt, since));
    const [allPharmacy] = await this.db
      .select({ n: count() })
      .from(pharmacyInquiries)
      .where(gte(pharmacyInquiries.createdAt, since));
    if (all.n + allPharmacy.n >= total) return 'daily_total_limit';
    if (isDemo) return null;
    const perFamily = this.config.get<number>('CALL_DAILY_LIMIT_PER_FAMILY') ?? 3;
    const [mine] = await this.db
      .select({ n: count() })
      .from(doses)
      .innerJoin(medications, eq(doses.medicationId, medications.id))
      .innerJoin(members, eq(medications.patientId, members.id))
      .where(and(eq(members.familyId, familyId), gte(doses.callRequestedAt, since)));
    const [minePharmacy] = await this.db
      .select({ n: count() })
      .from(pharmacyInquiries)
      .where(and(eq(pharmacyInquiries.familyId, familyId), gte(pharmacyInquiries.createdAt, since)));
    return mine.n + minePharmacy.n >= perFamily ? 'daily_family_limit' : null;
  }

  /** Records the call outcome. A dose not confirmed by voice alerts the family right away. */
  async applyResult(doseId: string, result: VoiceResult): Promise<'taken' | 'missed' | 'ignored'> {
    const [dose] = await this.db
      .select({ status: doses.status, scheduledAt: doses.scheduledAt, demo: doses.demo, patientId: medications.patientId })
      .from(doses)
      .innerJoin(medications, eq(doses.medicationId, medications.id))
      .where(eq(doses.id, doseId));
    if (!dose) throw new NotFoundException('Dose não encontrada.');
    const saved = await this.saveCall(doseId, result);
    if (saved && result.feelsUnwell) {
      await this.alertUnwell(doseId, result.note, Boolean(result.emergency));
      telemetry.capture(
        'patient_reported_unwell',
        { dose_id: doseId, call_id: result.sessionId, demo: dose.demo, emergency: Boolean(result.emergency) },
        dose.patientId,
      );
    }
    if (saved && result.emergency) {
      try {
        await this.callCaregivers(doseId, result.note);
      } catch (error) {
        telemetry.captureException(error, { step: 'emergency_call', dose_id: doseId });
      }
      if (!result.checkIn) await this.scheduleCheckIn(doseId);
    }
    // The call back after an emergency only reports how she is; the dose was already settled.
    if (result.checkIn) {
      telemetry.capture(
        'emergency_checkin_result',
        { dose_id: doseId, call_id: result.sessionId, outcome: result.outcome, feels_unwell: Boolean(result.feelsUnwell), demo: dose.demo },
        dose.patientId,
      );
      return 'ignored';
    }
    const props = { dose_id: doseId, call_id: result.sessionId, outcome: result.outcome, demo: dose.demo };
    // Confirmed in the app while the phone was ringing: the app wins.
    if (dose.status === 'taken') {
      telemetry.capture('dose_voice_result', { ...props, applied: 'ignored' }, dose.patientId);
      return 'ignored';
    }

    if (result.confirmed) {
      telemetry.capture('dose_voice_result', { ...props, applied: 'taken' }, dose.patientId);
      telemetry.capture(
        'dose_confirmed',
        { dose_id: doseId, via: 'voice', call_id: result.sessionId, minutes_since_scheduled: minutesSince(dose.scheduledAt), demo: dose.demo },
        dose.patientId,
      );
      this.logger.log(`Dose ${doseId} confirmed by voice (${result.sessionId}).`);
      await this.db
        .update(doses)
        .set({ status: 'taken', confirmedVia: 'voice', confirmedAt: new Date() })
        .where(eq(doses.id, doseId));
      await (await this.queue.getJob(alertJobId(doseId)))?.remove();
      try {
        await this.stock.checkAfterDose(doseId);
      } catch (error) {
        telemetry.captureException(error, { step: 'low_stock_check', dose_id: doseId });
      }
      return 'taken';
    }

    await this.db
      .update(doses)
      .set({ status: 'missed' })
      .where(and(eq(doses.id, doseId), eq(doses.status, 'pending')));
    await this.alertNow(doseId);
    telemetry.capture('dose_voice_result', { ...props, applied: 'missed' }, dose.patientId);
    this.logger.log(`Dose ${doseId} not confirmed by voice (${result.outcome}); alerting family.`);
    return 'missed';
  }

  /** Stores the call. apps/voice retries the POST, so the same session is written once. */
  private async saveCall(doseId: string, result: VoiceResult): Promise<boolean> {
    const rows = await this.db
      .insert(voiceCalls)
      .values({
        doseId,
        sessionId: result.sessionId,
        outcome: result.outcome,
        confirmed: result.confirmed,
        note: result.note ?? null,
        feelsUnwell: result.feelsUnwell ?? null,
        transcript: result.transcript ?? [],
        durationSeconds: result.durationSeconds == null ? null : Math.round(result.durationSeconds),
        endReason: result.endReason ?? null,
        error: result.error ?? null,
      })
      .onConflictDoNothing({ target: voiceCalls.sessionId })
      .returning({ id: voiceCalls.id });
    return rows.length > 0;
  }

  /** She told the assistant it would call back: queue that call (EMERGENCY_CHECKIN_MINUTES). */
  private async scheduleCheckIn(doseId: string): Promise<void> {
    const minutes = this.config.get<number>('EMERGENCY_CHECKIN_MINUTES') ?? 10;
    await this.queue.add(
      'check-in',
      { kind: 'check-in', doseId },
      { jobId: doseJobId('check-in', doseId), delay: minutes * 60_000 },
    );
    this.logger.log(`Dose ${doseId}: calling her back in ${minutes} min.`);
  }

  /**
   * Emergency reported on the call: phones only the family's first contact (members.emergencyContact,
   * else the oldest caregiver with a phone) with a short recorded-style message. Calling everyone causes alarm.
   * Only numbers in the voice CALL_ALLOWED_NUMBERS get through; the push already went out either way.
   */
  private async callCaregivers(doseId: string, note?: string | null): Promise<void> {
    const voiceUrl = this.config.get<string>('VOICE_URL');
    const token = this.config.get<string>('VOICE_API_TOKEN');
    if (!voiceUrl || !token) return;
    const [patient] = await this.db
      .select({ name: sql<string>`coalesce(${members.nickname}, ${members.name})`, familyId: members.familyId })
      .from(doses)
      .innerJoin(medications, eq(doses.medicationId, medications.id))
      .innerJoin(members, eq(medications.patientId, members.id))
      .where(eq(doses.id, doseId));
    if (!patient) return;
    const caregivers = await this.db
      .select({ id: members.id, phone: members.phone })
      .from(members)
      .where(and(eq(members.familyId, patient.familyId), eq(members.role, 'caregiver'), isNotNull(members.phone), ne(members.phone, '')))
      .orderBy(desc(members.emergencyContact), asc(members.createdAt))
      .limit(1);
    const said = note?.trim() ? ` disse agora na ligação do remédio: "${note.trim().slice(0, 200)}"` : ' disse agora na ligação do remédio que não está bem';
    const message = `Olá, aqui é a assistente virtual da Recuidado. ${patient.name}${said}. Por favor, ligue para ela agora. Se for grave, ligue para o SAMU, 192. Obrigada, tchau.`;
    for (const c of caregivers) {
      const res = await fetch(new URL('/alert-calls', voiceUrl), {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ doseId, phone: c.phone, message }),
      });
      const outcome = res.ok ? 'requested' : res.status === 403 ? 'number_not_allowed' : `error_${res.status}`;
      telemetry.capture('emergency_call', { dose_id: doseId, outcome }, c.id);
      this.logger.log(`Dose ${doseId}: emergency call to a caregiver ${outcome}.`);
    }
  }

  private async alertUnwell(doseId: string, note?: string | null, emergency = false): Promise<void> {
    const [row] = await this.db
      .select({ patientName: sql<string>`coalesce(${members.nickname}, ${members.name})`, familyId: members.familyId })
      .from(doses)
      .innerJoin(medications, eq(doses.medicationId, medications.id))
      .innerJoin(members, eq(medications.patientId, members.id))
      .where(eq(doses.id, doseId));
    if (!row) return;
    const said = note?.trim() ? `Ela disse: "${note.trim()}".` : 'Ela disse que não está bem.';
    const { sent } = await this.alerts.notifyCaregivers(row.familyId, {
      kind: 'unwell',
      title: emergency ? `Urgente: ${row.patientName} pode precisar de ajuda` : `${row.patientName} não está se sentindo bem`,
      body: `${said} Vale ligar para ela.`,
      url: '/family',
      doseId,
    });
    this.logger.log(`Dose ${doseId}: patient reported feeling unwell; ${sent} pushes sent.`);
  }

  /** Calls made for a dose, newest first. */
  listCalls(doseId: string) {
    return this.db.query.voiceCalls.findMany({
      where: eq(voiceCalls.doseId, doseId),
      orderBy: (c, { desc }) => [desc(c.createdAt)],
    });
  }

  private async alertNow(doseId: string): Promise<void> {
    const id = alertJobId(doseId);
    const existing = await this.queue.getJob(id);
    if (existing && (await existing.isDelayed())) {
      await existing.promote();
      return;
    }
    if (!existing) {
      await this.queue.add('alert-family', { kind: 'alert-family', doseId }, { jobId: id });
    }
  }

  /**
   * Demo only: creates a synthetic patient, medication and a pending dose due now, then calls.
   * The phone comes from the request so no real number is ever committed.
   */
  async createDemoDose(input: {
    phone: string;
    patientName: string;
    medication: string;
    strength?: string;
    caregiverPhone?: string;
  }): Promise<string> {
    const familyName = 'Família Demo';
    let [family] = await this.db.select().from(families).where(eq(families.name, familyName));
    if (!family) {
      [family] = await this.db.insert(families).values({ name: familyName }).returning();
    }
    let [patient] = await this.db
      .select()
      .from(members)
      .where(and(eq(members.familyId, family.id), eq(members.role, 'patient'), eq(members.name, input.patientName)));
    if (!patient) {
      [patient] = await this.db
        .insert(members)
        .values({ familyId: family.id, name: input.patientName, role: 'patient', phone: input.phone, prefersVoice: true })
        .returning();
    } else if (patient.phone !== input.phone) {
      await this.db.update(members).set({ phone: input.phone }).where(eq(members.id, patient.id));
    }
    if (input.caregiverPhone) {
      const [caregiver] = await this.db
        .select({ id: members.id })
        .from(members)
        .where(and(eq(members.familyId, family.id), eq(members.role, 'caregiver')))
        .orderBy(members.createdAt)
        .limit(1);
      if (caregiver) await this.db.update(members).set({ phone: input.caregiverPhone }).where(eq(members.id, caregiver.id));
    }
    const [medication] = await this.db
      .insert(medications)
      .values({ patientId: patient.id, name: input.medication, strength: input.strength })
      .returning();
    const [dose] = await this.db
      .insert(doses)
      .values({ medicationId: medication.id, scheduledAt: new Date(), demo: true })
      .returning();
    return dose.id;
  }

  async getDose(doseId: string) {
    const [dose] = await this.db.select().from(doses).where(eq(doses.id, doseId));
    if (!dose) throw new NotFoundException('Dose não encontrada.');
    return dose;
  }
}
