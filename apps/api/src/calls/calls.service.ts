import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, desc, eq, isNotNull, or, sql } from 'drizzle-orm';
import {
  callLogs,
  type CallEvent,
  DB,
  type Database,
  DEMO_FAMILY,
  doses,
  families,
  medications,
  members,
  pharmacyInquiries,
  telemetry,
} from '@recuidado/core';
import { type R2Bucket, r2FromConfig } from './r2.js';

export type CallKind = 'reminder' | 'recall' | 'check_in' | 'caregiver' | 'pharmacy';

export interface CallLogInput {
  sessionId: string;
  kind: CallKind;
  doseId?: string | null;
  inquiryId?: string | null;
  outcome?: string | null;
  durationSeconds?: number | null;
  startedAt?: string | null;
  transcript: { speaker: string; text: string }[];
  events: CallEvent[];
}

/** What the calls panel shows for one call. */
export interface CallLogView {
  sessionId: string;
  kind: CallKind | null;
  outcome: string | null;
  durationSeconds: number | null;
  startedAt: string;
  transcript: { speaker: string; text: string }[];
  events: CallEvent[];
  /** The voice did not record the pharmacy's answer; Claude read it from the transcript after the call. */
  readFromTranscript: boolean;
  /** Pharmacy calls: what was recorded, from the inquiry. */
  pharmacyAnswer: {
    answers: (typeof pharmacyInquiries.$inferSelect)['answers'];
    matchesOffers: 'yes' | 'no' | 'unknown' | null;
  } | null;
  hasRecording: boolean;
}

/**
 * The calls panel of the proof of concept: transcript, steps and recording of each call.
 * apps/voice sends the log when a call ends; Asterisk sends the recording a moment later, in any order.
 */
@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);
  private readonly r2?: R2Bucket;

  constructor(
    @Inject(DB) private readonly db: Database,
    config: ConfigService,
  ) {
    this.r2 = r2FromConfig(config);
  }

  async saveLog(input: CallLogInput): Promise<void> {
    const familyId = await this.familyOf(input);
    const values = {
      kind: input.kind,
      familyId,
      doseId: input.doseId ?? null,
      inquiryId: input.inquiryId ?? null,
      outcome: input.outcome ?? null,
      durationSeconds: input.durationSeconds == null ? null : Math.round(input.durationSeconds),
      startedAt: input.startedAt ? new Date(input.startedAt) : null,
      transcript: input.transcript,
      events: input.events,
    };
    await this.db
      .insert(callLogs)
      .values({ sessionId: input.sessionId, ...values })
      .onConflictDoUpdate({ target: callLogs.sessionId, set: values });
  }

  /** The WAV Asterisk recorded. Goes to R2 when configured, else into the row. */
  async saveRecording(sessionId: string, audio: Buffer): Promise<void> {
    let set: { recordingKey: string | null; recording: Buffer | null; recordingBytes: number };
    if (this.r2) {
      const key = `calls/${sessionId}.wav`;
      await this.r2.put(key, audio, 'audio/wav');
      set = { recordingKey: key, recording: null, recordingBytes: audio.length };
    } else {
      set = { recordingKey: null, recording: audio, recordingBytes: audio.length };
    }
    await this.db
      .insert(callLogs)
      .values({ sessionId, ...set })
      .onConflictDoUpdate({ target: callLogs.sessionId, set });
    telemetry.capture('call_recording_saved', { call_id: sessionId, bytes: audio.length, storage: this.r2 ? 'r2' : 'postgres' });
    this.logger.log(`Recording of ${sessionId} saved (${audio.length} bytes, ${this.r2 ? 'R2' : 'Postgres'}).`);
  }

  /** Who the panel shows: the signed-in family, or the demo family (synthetic data) for visitors. */
  private familyFilter(familyId: string | null) {
    return familyId ? eq(callLogs.familyId, familyId) : eq(families.name, DEMO_FAMILY);
  }

  /** Calls of one family, newest first: the signed-in family's, or the demo family's for visitors. */
  async list(familyId: string | null, limit = 30): Promise<CallLogView[]> {
    const rows = await this.db
      .select({
        sessionId: callLogs.sessionId,
        kind: callLogs.kind,
        outcome: callLogs.outcome,
        inquiryStatus: pharmacyInquiries.status,
        inquiryAnswers: pharmacyInquiries.answers,
        matchesOffers: pharmacyInquiries.matchesOffers,
        durationSeconds: callLogs.durationSeconds,
        startedAt: callLogs.startedAt,
        createdAt: callLogs.createdAt,
        transcript: callLogs.transcript,
        events: callLogs.events,
        hasRecording: sql<boolean>`(${callLogs.recordingKey} is not null or ${callLogs.recording} is not null)`,
      })
      .from(callLogs)
      .innerJoin(families, eq(callLogs.familyId, families.id))
      // A pharmacy call the voice model ended as "unclear" can still get its answer later, when Claude
      // reads the transcript. The inquiry has the final status, so the panel shows that one.
      .leftJoin(pharmacyInquiries, eq(pharmacyInquiries.sessionId, callLogs.sessionId))
      .where(and(this.familyFilter(familyId), isNotNull(callLogs.kind)))
      .orderBy(desc(callLogs.createdAt))
      .limit(Math.min(Math.max(limit, 1), 100));
    return rows.map((r) => ({
      sessionId: r.sessionId,
      kind: r.kind,
      outcome: r.inquiryStatus && r.inquiryStatus !== 'calling' ? r.inquiryStatus : r.outcome,
      readFromTranscript: r.outcome === 'unclear' && r.inquiryStatus === 'answered',
      pharmacyAnswer: r.inquiryAnswers ? { answers: r.inquiryAnswers, matchesOffers: r.matchesOffers ?? null } : null,
      durationSeconds: r.durationSeconds,
      startedAt: (r.startedAt ?? r.createdAt).toISOString(),
      transcript: r.transcript,
      events: r.events,
      hasRecording: r.hasRecording,
    }));
  }

  /** The recording of a call of that family (demo for visitors): a signed R2 link, or the bytes kept in Postgres. */
  async recording(sessionId: string, familyId: string | null): Promise<{ url: string } | { audio: Buffer }> {
    const [row] = await this.db
      .select({ key: callLogs.recordingKey, audio: callLogs.recording })
      .from(callLogs)
      .innerJoin(families, eq(callLogs.familyId, families.id))
      .where(and(eq(callLogs.sessionId, sessionId), this.familyFilter(familyId), or(isNotNull(callLogs.recordingKey), isNotNull(callLogs.recording))));
    if (!row) throw new NotFoundException('Gravação não encontrada.');
    if (row.key && this.r2) return { url: await this.r2.signedUrl(row.key) };
    if (row.audio) return { audio: row.audio };
    throw new NotFoundException('Gravação não encontrada.');
  }

  private async familyOf(input: CallLogInput): Promise<string | null> {
    if (input.doseId) {
      const [row] = await this.db
        .select({ familyId: members.familyId })
        .from(doses)
        .innerJoin(medications, eq(doses.medicationId, medications.id))
        .innerJoin(members, eq(medications.patientId, members.id))
        .where(eq(doses.id, input.doseId));
      return row?.familyId ?? null;
    }
    if (input.inquiryId) {
      const [row] = await this.db
        .select({ familyId: pharmacyInquiries.familyId })
        .from(pharmacyInquiries)
        .where(eq(pharmacyInquiries.id, input.inquiryId));
      return row?.familyId ?? null;
    }
    return null;
  }
}
