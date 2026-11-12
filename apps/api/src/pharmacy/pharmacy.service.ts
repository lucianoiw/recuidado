import {
  BadRequestException,
  BadGatewayException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { ConfigService } from '@nestjs/config';
import { and, desc, eq, gte, inArray, isNull } from 'drizzle-orm';
import { type Database, DB, medications, pharmacyInquiries, telemetry, VoiceCallService } from '@recuidado/core';
import { FamilyService } from '../family/family.service.js';
import { readPharmacyTranscript } from './transcript-reader.js';
import { cmedPriceOf } from '../family/pricing.js';
import { randomUUID } from 'node:crypto';

/** At most this many medicines per call, so the call stays short. */
export const MAX_MEDICATIONS_PER_CALL = 3;
/** A call that never reported back after this long is shown as failed. */
const STALE_AFTER_MS = 6 * 60 * 1000;

/** Body that apps/voice posts to /pharmacy-inquiries/:id/voice-result. */
export interface PharmacyVoiceResult {
  sessionId: string;
  outcome: 'answered' | 'unclear' | 'no_answer' | 'failed';
  items: {
    medication: string;
    available: 'yes' | 'no' | 'unknown';
    priceCents: number | null;
    genericPriceCents?: number | null;
    referencePriceCents?: number | null;
    package?: string | null;
  }[];
  note?: string | null;
  keysPressed?: string[];
  transcript?: { speaker: 'assistant' | 'patient'; text: string }[];
  durationSeconds?: number | null;
  endReason?: string | null;
  error?: string | null;
}

type Inquiry = typeof pharmacyInquiries.$inferSelect;

/** A pharmacy the agent may call: name shown to the family and the number dialed. */
export interface PharmacyTarget {
  name: string;
  phone: string;
}

/**
 * PHARMACY_CALL_TARGETS: "Name|+55...,Name|+55..." (the simulated pharmacies of the demo), or the
 * single PHARMACY_CALL_PHONE with PHARMACY_CALL_NAME. Numbers never come from the request.
 */
export function pharmacyTargets(targets: string | undefined, phone: string | undefined, name: string | undefined): PharmacyTarget[] {
  const list = (targets ?? '')
    .split(',')
    .map((entry) => entry.split('|').map((x) => x.trim()))
    .filter(([n, p]) => n && p)
    .map(([n, p]) => ({ name: n, phone: p }));
  if (list.length > 0) return list.slice(0, 3);
  return phone ? [{ name: name || 'Farmácia de teste', phone }] : [];
}

const NO_PLAN_MESSAGE = 'A ligação para a farmácia faz parte do plano Recuidado Família. Ative em Família > Plano.';
const LIMIT_MESSAGE =
  'Limite de ligações de hoje atingido. Ligações custam dinheiro, por isso há um limite por dia.';

@Injectable()
export class PharmacyService {
  private readonly logger = new Logger(PharmacyService.name);
  private client: Anthropic | undefined;

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly config: ConfigService,
    private readonly family: FamilyService,
    private readonly voice: VoiceCallService,
  ) {}

  /**
   * Asks apps/voice to call the pharmacy about some of the family's medicines.
   * The number dialed comes only from PHARMACY_CALL_PHONE, never from the request.
   */
  async ask(familyId: string | null, medicationIds: string[], now = new Date()) {
    const voiceUrl = this.config.get<string>('VOICE_URL');
    const token = this.config.get<string>('VOICE_API_TOKEN');
    const targets = pharmacyTargets(
      this.config.get<string>('PHARMACY_CALL_TARGETS'),
      this.config.get<string>('PHARMACY_CALL_PHONE'),
      this.config.get<string>('PHARMACY_CALL_NAME'),
    );
    if (!voiceUrl || !token || targets.length === 0) {
      throw new ServiceUnavailableException('Ligação para a farmácia indisponível no momento.');
    }
    const ref = await this.family.resolveFamily(familyId);

    // One round of calls at a time per family: a second tap follows the calls already ringing.
    const [ongoing] = await this.db
      .select()
      .from(pharmacyInquiries)
      .where(
        and(
          eq(pharmacyInquiries.familyId, ref.familyId),
          eq(pharmacyInquiries.status, 'calling'),
          gte(pharmacyInquiries.createdAt, new Date(now.getTime() - STALE_AFTER_MS)),
        ),
      )
      .limit(1);
    if (ongoing) return this.batchOf(ongoing, now);

    const ids = [...new Set(medicationIds)];
    if (ids.length === 0) throw new BadRequestException('Escolha pelo menos um remédio.');
    const meds = await this.db
      .select({
        id: medications.id,
        name: medications.name,
        strength: medications.strength,
        activeIngredient: medications.activeIngredient,
      })
      .from(medications)
      .where(and(eq(medications.patientId, ref.patientId), inArray(medications.id, ids), isNull(medications.stoppedAt)));
    if (meds.length === 0) throw new NotFoundException('Remédio não encontrado.');
    const asked = meds
      .sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
      .slice(0, MAX_MEDICATIONS_PER_CALL);

    if (!(await this.voice.callsAllowed(ref.familyId, ref.isDemo))) {
      telemetry.capture('pharmacy_call_skipped', { reason: 'no_plan', demo: ref.isDemo }, ref.patientId);
      throw new HttpException(NO_PLAN_MESSAGE, HttpStatus.PAYMENT_REQUIRED);
    }
    const overLimit = await this.voice.overCallLimit(ref.familyId, ref.isDemo, now);
    if (overLimit) {
      telemetry.capture('pharmacy_call_skipped', { reason: overLimit, demo: ref.isDemo }, ref.patientId);
      throw new HttpException(LIMIT_MESSAGE, HttpStatus.TOO_MANY_REQUESTS);
    }

    const batchId = randomUUID();
    const rows = await this.db
      .insert(pharmacyInquiries)
      .values(
        targets.map((t) => ({
          familyId: ref.familyId,
          pharmacyName: t.name,
          batchId,
          medications: asked.map((m) => ({ medicationId: m.id, name: m.name, strength: m.strength })),
          createdAt: now,
        })),
      )
      .returning();

    // The CMED box goes along so a simulated pharmacy can say a believable price; a real one ignores it.
    const spoken = asked.map((m) => {
      const price = cmedPriceOf(m.activeIngredient, m.name, m.strength, 1);
      return {
        name: m.name,
        dose: m.strength ?? undefined,
        refPackCents: price?.packCents,
        unitsPerPack: price?.unitsPerPack,
      };
    });
    const results = await Promise.allSettled(
      rows.map((row, i) => this.startCall(row, targets[i].phone, ref.familyId, spoken, voiceUrl, token)),
    );
    const started = results.filter((r) => r.status === 'fulfilled').length;
    telemetry.capture(
      'pharmacy_call_requested',
      { batch_id: batchId, pharmacies: rows.length, started, medications: asked.length, demo: ref.isDemo },
      ref.patientId,
    );
    if (started === 0) throw (results[0] as PromiseRejectedResult).reason;
    return this.batchOf(rows[0], now);
  }

  /** Asks apps/voice to dial one pharmacy. Marks the inquiry failed when the call does not start. */
  private async startCall(
    inquiry: Inquiry,
    phone: string,
    familyId: string,
    meds: { name: string; dose?: string; refPackCents?: number; unitsPerPack?: number }[],
    voiceUrl: string,
    token: string,
  ) {
    let res: Response;
    try {
      res = await fetch(new URL('/pharmacy-calls', voiceUrl), {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ inquiryId: inquiry.id, familyId, phone, medications: meds }),
      });
    } catch (error) {
      await this.fail(inquiry.id, `voice unreachable: ${(error as Error).message}`);
      throw new BadGatewayException('Não foi possível ligar agora. Tente de novo em instantes.');
    }
    if (!res.ok) {
      const detail = res.status === 403 ? 'number_not_allowed' : `voice answered ${res.status}`;
      await this.fail(inquiry.id, detail);
      this.logger.warn(`Pharmacy call ${inquiry.id} not started: ${detail}.`);
      if (res.status === 403) {
        throw new ServiceUnavailableException('O número da farmácia de teste não está liberado para ligação.');
      }
      throw new BadGatewayException('Não foi possível ligar agora. Tente de novo em instantes.');
    }
    const { callId } = (await res.json()) as { callId: string };
    await this.db.update(pharmacyInquiries).set({ sessionId: callId }).where(eq(pharmacyInquiries.id, inquiry.id));
    this.logger.log(`Calling ${inquiry.pharmacyName} for inquiry ${inquiry.id} (${callId}).`);
  }

  /** The calls placed together with this one, in the order they were placed. */
  private async batchOf(row: Inquiry, now = new Date()) {
    const rows = row.batchId
      ? await this.db
          .select()
          .from(pharmacyInquiries)
          .where(eq(pharmacyInquiries.batchId, row.batchId))
          .orderBy(pharmacyInquiries.createdAt, pharmacyInquiries.pharmacyName)
      : [row];
    const views = rows.map((r) => this.view(r, now));
    return { inquiry: views.find((v) => v.id === row.id) ?? views[0], inquiries: views };
  }

  /** The family's most recent pharmacy call, or null. */
  async latest(familyId: string | null, now = new Date()) {
    const ref = await this.family.resolveFamily(familyId);
    const [row] = await this.db
      .select()
      .from(pharmacyInquiries)
      .where(eq(pharmacyInquiries.familyId, ref.familyId))
      .orderBy(desc(pharmacyInquiries.createdAt))
      .limit(1);
    return row ? this.batchOf(row, now) : { inquiry: null, inquiries: [] };
  }

  /** Stores what the pharmacy said. apps/voice retries the POST, so a finished inquiry is kept as is. */
  async applyResult(id: string, result: PharmacyVoiceResult) {
    // The call can end (the pharmacy hangs up) before the voice model records the answer.
    // Then Claude reads the answer from the transcript. Until it finishes, the family still sees "calling".
    const heard = (result.transcript ?? []).some((l) => l.speaker === 'patient' && l.text.trim());
    const readLater =
      result.outcome === 'unclear' &&
      result.items.length === 0 &&
      heard &&
      Boolean(this.config.get<string>('ANTHROPIC_API_KEY'));
    const [row] = await this.db
      .update(pharmacyInquiries)
      .set({
        status: readLater ? 'calling' : result.outcome,
        sessionId: result.sessionId,
        answers: result.items.map((i) => ({
          medication: i.medication,
          available: i.available,
          priceCents: i.priceCents,
          genericPriceCents: i.genericPriceCents ?? null,
          referencePriceCents: i.referencePriceCents ?? null,
          package: i.package ?? undefined,
        })),
        note: result.note ?? null,
        keysPressed: result.keysPressed ?? [],
        transcript: result.transcript ?? [],
        durationSeconds: result.durationSeconds == null ? null : Math.round(result.durationSeconds),
        endReason: result.endReason ?? null,
        error: result.error ?? null,
        finishedAt: new Date(),
      })
      .where(and(eq(pharmacyInquiries.id, id), eq(pharmacyInquiries.status, 'calling')))
      .returning({
        id: pharmacyInquiries.id,
        familyId: pharmacyInquiries.familyId,
        medications: pharmacyInquiries.medications,
      });
    if (!row) {
      const [exists] = await this.db
        .select({ id: pharmacyInquiries.id })
        .from(pharmacyInquiries)
        .where(eq(pharmacyInquiries.id, id));
      if (!exists) throw new NotFoundException('Consulta não encontrada.');
      return 'ignored' as const;
    }
    telemetry.capture('pharmacy_answer_recorded', {
      inquiry_id: id,
      outcome: result.outcome,
      items: result.items.length,
      items_with_price: result.items.filter((i) => i.priceCents != null).length,
      keys_pressed: result.keysPressed?.length ?? 0,
    });
    // In the background, so apps/voice is not held.
    if (readLater) {
      void this.readTranscript(
        id,
        row.medications.map((m) => [m.name, m.strength].filter(Boolean).join(' ')),
        result.transcript ?? [],
      );
    }
    return 'recorded' as const;
  }

  /** Fills the answer from the call transcript. Never throws: on any problem the inquiry ends as unclear. */
  async readTranscript(id: string, meds: string[], transcript: NonNullable<PharmacyVoiceResult['transcript']>) {
    let update: Partial<Inquiry> = { status: 'unclear' };
    try {
      this.client ??= new Anthropic({ apiKey: this.config.get<string>('ANTHROPIC_API_KEY') });
      const { items, note } = await readPharmacyTranscript(this.client, meds, transcript);
      if (items.some((i) => i.available !== 'unknown' || i.priceCents != null)) {
        update = { status: 'answered', answers: items, note };
        telemetry.capture('pharmacy_answer_from_transcript', {
          inquiry_id: id,
          items: items.length,
          items_with_price: items.filter((i) => i.priceCents != null).length,
        });
      }
    } catch (error) {
      this.logger.warn(`reading pharmacy transcript failed: ${(error as Error).message}`);
    }
    await this.db
      .update(pharmacyInquiries)
      .set(update)
      .where(and(eq(pharmacyInquiries.id, id), eq(pharmacyInquiries.status, 'calling')))
      .catch((error: Error) => this.logger.warn(`saving pharmacy transcript reading failed: ${error.message}`));
  }

  private async fail(id: string, error: string) {
    await this.db
      .update(pharmacyInquiries)
      .set({ status: 'failed', error, finishedAt: new Date() })
      .where(eq(pharmacyInquiries.id, id));
  }

  /** What the family screen shows. The phone dialed is never sent. */
  view(row: Inquiry, now = new Date()) {
    const stale = row.status === 'calling' && now.getTime() - row.createdAt.getTime() > STALE_AFTER_MS;
    return {
      id: row.id,
      pharmacyName: row.pharmacyName,
      status: stale ? ('failed' as const) : row.status,
      medications: row.medications,
      answers: row.answers,
      note: row.note,
      usedPhoneMenu: row.keysPressed.length > 0,
      transcript: row.transcript,
      durationSeconds: row.durationSeconds,
      createdAt: row.createdAt,
      finishedAt: row.finishedAt,
    };
  }
}
