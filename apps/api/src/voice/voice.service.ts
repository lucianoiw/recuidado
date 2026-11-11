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
import { and, eq, sql } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module.js';
import { doses, families, medications, members, voiceCalls } from '../db/schema.js';
import { DOSES_QUEUE, doseJobId, type DoseJob } from '../doses/doses.queue.js';
import { minutesSince } from '../doses/time.js';
import { telemetry } from '../telemetry/telemetry.js';

/** Body that apps/voice posts to /doses/:id/voice-result. */
export interface VoiceResult {
  sessionId: string;
  outcome: 'confirmed' | 'not_taken' | 'unclear' | 'no_answer' | 'failed';
  confirmed: boolean;
  note?: string | null;
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
  ) {}

  /** Asks apps/voice to call the patient. Does nothing if the dose is no longer pending. */
  async call(doseId: string): Promise<{ callId: string } | null> {
    const voiceUrl = this.config.get<string>('VOICE_URL');
    const token = this.config.get<string>('VOICE_API_TOKEN');
    if (!voiceUrl || !token) {
      throw new ServiceUnavailableException('Ligação indisponível: VOICE_URL ou VOICE_API_TOKEN não configurado.');
    }

    const [row] = await this.db
      .select({
        status: doses.status,
        patientId: members.id,
        patientName: sql<string>`coalesce(${members.nickname}, ${members.name})`,
        phone: members.phone,
        medication: medications.name,
        strength: medications.strength,
      })
      .from(doses)
      .innerJoin(medications, eq(doses.medicationId, medications.id))
      .innerJoin(members, eq(medications.patientId, members.id))
      .where(eq(doses.id, doseId));
    if (!row) throw new NotFoundException('Dose não encontrada.');
    if (row.status !== 'pending') {
      this.logger.log(`Dose ${doseId} is ${row.status}; not calling.`);
      return null;
    }
    if (!row.phone) {
      this.logger.warn(`Patient of dose ${doseId} has no phone; not calling.`);
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
      }),
    });
    if (!res.ok) {
      throw new Error(`Voice service answered ${res.status}: ${await res.text()}`);
    }
    const body = (await res.json()) as { callId: string };
    telemetry.capture(
      'dose_call_requested',
      { dose_id: doseId, call_id: body.callId, medication: row.medication },
      row.patientId,
    );
    this.logger.log(`Calling patient of dose ${doseId} (${body.callId}).`);
    return body;
  }

  /** Records the call outcome. A dose not confirmed by voice alerts the family right away. */
  async applyResult(doseId: string, result: VoiceResult): Promise<'taken' | 'missed' | 'ignored'> {
    const [dose] = await this.db
      .select({ status: doses.status, scheduledAt: doses.scheduledAt, patientId: medications.patientId })
      .from(doses)
      .innerJoin(medications, eq(doses.medicationId, medications.id))
      .where(eq(doses.id, doseId));
    if (!dose) throw new NotFoundException('Dose não encontrada.');
    await this.saveCall(doseId, result);
    const props = { dose_id: doseId, call_id: result.sessionId, outcome: result.outcome };
    // Confirmed in the app while the phone was ringing: the app wins.
    if (dose.status === 'taken') {
      telemetry.capture('dose_voice_result', { ...props, applied: 'ignored' }, dose.patientId);
      return 'ignored';
    }

    if (result.confirmed) {
      telemetry.capture('dose_voice_result', { ...props, applied: 'taken' }, dose.patientId);
      telemetry.capture(
        'dose_confirmed',
        { dose_id: doseId, via: 'voice', call_id: result.sessionId, minutes_since_scheduled: minutesSince(dose.scheduledAt) },
        dose.patientId,
      );
      this.logger.log(`Dose ${doseId} confirmed by voice (${result.sessionId}).`);
      await this.db
        .update(doses)
        .set({ status: 'taken', confirmedVia: 'voice', confirmedAt: new Date() })
        .where(eq(doses.id, doseId));
      await (await this.queue.getJob(alertJobId(doseId)))?.remove();
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
  private async saveCall(doseId: string, result: VoiceResult): Promise<void> {
    await this.db
      .insert(voiceCalls)
      .values({
        doseId,
        sessionId: result.sessionId,
        outcome: result.outcome,
        confirmed: result.confirmed,
        note: result.note ?? null,
        transcript: result.transcript ?? [],
        durationSeconds: result.durationSeconds == null ? null : Math.round(result.durationSeconds),
        endReason: result.endReason ?? null,
        error: result.error ?? null,
      })
      .onConflictDoNothing({ target: voiceCalls.sessionId });
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
    const [medication] = await this.db
      .insert(medications)
      .values({ patientId: patient.id, name: input.medication, strength: input.strength })
      .returning();
    const [dose] = await this.db
      .insert(doses)
      .values({ medicationId: medication.id, scheduledAt: new Date() })
      .returning();
    return dose.id;
  }

  async getDose(doseId: string) {
    const [dose] = await this.db.select().from(doses).where(eq(doses.id, doseId));
    if (!dose) throw new NotFoundException('Dose não encontrada.');
    return dose;
  }
}
