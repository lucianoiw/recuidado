import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, asc, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import {
  alerts,
  callLogs,
  costShares,
  type Database,
  DB,
  doses,
  families,
  medications,
  members,
  pushSubscriptions,
  telemetry,
  voiceCalls,
} from '@recuidado/core';
import { DEMO_FAMILY, DEMO_READ_ONLY } from '../family/family.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** LGPD: patient consent, data export, family deletion and transcript retention. */
@Injectable()
export class PrivacyService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(PrivacyService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    // Once on boot and then every 6 hours. Idempotent, so several API containers are fine.
    const run = () =>
      this.purgeTranscripts().catch((error) => {
        telemetry.captureException(error, { step: 'transcript_retention' });
        this.logger.error(`Transcript retention failed: ${String(error)}`);
      });
    void run();
    this.timer = setInterval(run, 6 * 60 * 60 * 1000);
    this.timer.unref();
  }

  onApplicationShutdown() {
    clearInterval(this.timer);
  }

  /**
   * Empties transcripts and notes of calls older than VOICE_TRANSCRIPT_RETENTION_DAYS.
   * The outcome (took it or not, felt unwell) stays for the dose history.
   */
  async purgeTranscripts(now = new Date()): Promise<number> {
    const days = this.config.get<number>('VOICE_TRANSCRIPT_RETENTION_DAYS') ?? 90;
    const before = new Date(now.getTime() - days * DAY_MS);
    const purged = await this.db
      .update(voiceCalls)
      .set({ transcript: [], note: null })
      .where(
        and(
          lt(voiceCalls.createdAt, before),
          sql`(jsonb_array_length(${voiceCalls.transcript}) > 0 or ${voiceCalls.note} is not null)`,
        ),
      )
      .returning({ id: voiceCalls.id });
    // The calls panel: transcript, steps and the recording kept in Postgres. R2 objects expire by the bucket's lifecycle rule.
    await this.db
      .update(callLogs)
      .set({ transcript: [], events: [], recording: null })
      .where(and(lt(callLogs.createdAt, before), sql`(jsonb_array_length(${callLogs.transcript}) > 0 or ${callLogs.recording} is not null)`));
    if (purged.length > 0) {
      telemetry.capture('transcripts_purged', { calls: purged.length, retention_days: days });
      this.logger.log(`Emptied ${purged.length} call transcripts older than ${days} days.`);
    }
    return purged.length;
  }

  /**
   * The patient accepts (or takes back) reminders, calls and the family seeing her doses.
   * Taking it back also removes her push subscriptions. The demo family never changes.
   */
  async setPatientConsent(patientId: string, accepted: boolean, now = new Date()): Promise<void> {
    const patient = await this.patientWithFamily(patientId);
    if (patient.familyName === DEMO_FAMILY) return;
    await this.db
      .update(members)
      .set(accepted ? { consentAt: now, consentSource: 'patient' } : { consentAt: null, consentSource: null })
      .where(eq(members.id, patientId));
    if (!accepted) await this.db.delete(pushSubscriptions).where(eq(pushSubscriptions.memberId, patientId));
    telemetry.capture(accepted ? 'consent_given' : 'consent_revoked', { source: 'patient' }, patientId);
  }

  /** Everything stored about the family of this caregiver, as JSON (LGPD art. 18, II and V). */
  async exportFamily(caregiverId: string, now = new Date()) {
    const family = await this.familyOfCaregiver(caregiverId);
    const people = await this.db
      .select()
      .from(members)
      .where(eq(members.familyId, family.id))
      .orderBy(asc(members.createdAt));
    const memberIds = people.map((m) => m.id);
    const meds = await this.db
      .select()
      .from(medications)
      .where(inArray(medications.patientId, memberIds))
      .orderBy(asc(medications.createdAt));
    const medIds = meds.map((m) => m.id);
    const doseRows = medIds.length
      ? await this.db.select().from(doses).where(inArray(doses.medicationId, medIds)).orderBy(asc(doses.scheduledAt))
      : [];
    const doseIds = doseRows.map((d) => d.id);
    const calls = doseIds.length
      ? await this.db
          .select({
            id: voiceCalls.id,
            doseId: voiceCalls.doseId,
            outcome: voiceCalls.outcome,
            confirmed: voiceCalls.confirmed,
            feelsUnwell: voiceCalls.feelsUnwell,
            note: voiceCalls.note,
            transcript: voiceCalls.transcript,
            durationSeconds: voiceCalls.durationSeconds,
            createdAt: voiceCalls.createdAt,
          })
          .from(voiceCalls)
          .where(inArray(voiceCalls.doseId, doseIds))
          .orderBy(asc(voiceCalls.createdAt))
      : [];
    const subscriptions = await this.db
      .select({ memberId: pushSubscriptions.memberId, createdAt: pushSubscriptions.createdAt })
      .from(pushSubscriptions)
      .where(inArray(pushSubscriptions.memberId, memberIds));
    telemetry.capture('family_exported', {}, caregiverId);
    return {
      exportedAt: now.toISOString(),
      family: { id: family.id, name: family.name, createdAt: family.createdAt },
      members: people,
      medications: meds,
      doses: doseRows,
      voiceCalls: calls,
      alerts: await this.db.select().from(alerts).where(eq(alerts.familyId, family.id)).orderBy(asc(alerts.createdAt)),
      costShares: await this.db.select().from(costShares).where(eq(costShares.familyId, family.id)),
      // Only which members get notifications; the browser keys are not personal data worth exporting.
      pushSubscriptions: subscriptions,
    };
  }

  /** Deletes the family of this caregiver and everything under it (LGPD art. 18, VI). */
  async deleteFamily(caregiverId: string): Promise<void> {
    const family = await this.familyOfCaregiver(caregiverId);
    // Members, medications, doses, calls, alerts, cost shares and push subscriptions cascade.
    // Queued dose jobs find no dose and do nothing.
    await this.db.delete(families).where(eq(families.id, family.id));
    telemetry.capture('family_deleted', {});
    this.logger.log(`Family ${family.id} deleted at the family's request.`);
  }

  private async familyOfCaregiver(caregiverId: string) {
    const [row] = await this.db
      .select({ id: families.id, name: families.name, createdAt: families.createdAt })
      .from(members)
      .innerJoin(families, eq(members.familyId, families.id))
      // Only the caregiver who made the sign-up (not an invited one) exports or deletes.
      .where(and(eq(members.id, caregiverId), eq(members.role, 'caregiver'), isNull(members.invitedById)));
    if (!row) throw new NotFoundException('Só quem fez o cadastro pode baixar ou apagar os dados.');
    if (row.name === DEMO_FAMILY) throw new ForbiddenException(DEMO_READ_ONLY);
    return row;
  }

  private async patientWithFamily(patientId: string) {
    const [row] = await this.db
      .select({ id: members.id, familyName: families.name })
      .from(members)
      .innerJoin(families, eq(members.familyId, families.id))
      .where(and(eq(members.id, patientId), eq(members.role, 'patient')));
    if (!row) throw new NotFoundException('Pessoa não encontrada.');
    return row;
  }
}
