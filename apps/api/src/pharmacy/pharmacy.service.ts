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
import { ConfigService } from '@nestjs/config';
import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module.js';
import { medications, pharmacyInquiries } from '../db/schema.js';
import { FamilyService } from '../family/family.service.js';
import { VoiceCallService } from '../voice/voice.service.js';
import { telemetry } from '../telemetry/telemetry.js';

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
    package?: string | null;
    farmaciaPopular: 'yes' | 'no' | 'unknown';
  }[];
  note?: string | null;
  keysPressed?: string[];
  transcript?: { speaker: 'assistant' | 'patient'; text: string }[];
  durationSeconds?: number | null;
  endReason?: string | null;
  error?: string | null;
}

type Inquiry = typeof pharmacyInquiries.$inferSelect;

const LIMIT_MESSAGE =
  'Limite de ligações de hoje atingido. Ligações custam dinheiro, por isso há um limite por dia.';

@Injectable()
export class PharmacyService {
  private readonly logger = new Logger(PharmacyService.name);

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
    const phone = this.config.get<string>('PHARMACY_CALL_PHONE');
    if (!voiceUrl || !token || !phone) {
      throw new ServiceUnavailableException('Ligação para a farmácia indisponível no momento.');
    }
    const ref = await this.family.resolveFamily(familyId);

    // One call at a time per family: a second tap follows the call already ringing.
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
    if (ongoing) return this.view(ongoing, now);

    const ids = [...new Set(medicationIds)];
    if (ids.length === 0) throw new BadRequestException('Escolha pelo menos um remédio.');
    const meds = await this.db
      .select({ id: medications.id, name: medications.name, strength: medications.strength })
      .from(medications)
      .where(and(eq(medications.patientId, ref.patientId), inArray(medications.id, ids)));
    if (meds.length === 0) throw new NotFoundException('Remédio não encontrado.');
    const asked = meds
      .sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
      .slice(0, MAX_MEDICATIONS_PER_CALL);

    const overLimit = await this.voice.overCallLimit(ref.familyId, ref.isDemo, now);
    if (overLimit) {
      telemetry.capture('pharmacy_call_skipped', { reason: overLimit, demo: ref.isDemo }, ref.patientId);
      throw new HttpException(LIMIT_MESSAGE, HttpStatus.TOO_MANY_REQUESTS);
    }

    const [inquiry] = await this.db
      .insert(pharmacyInquiries)
      .values({
        familyId: ref.familyId,
        pharmacyName: this.config.get<string>('PHARMACY_CALL_NAME') ?? 'Farmácia de teste',
        medications: asked.map((m) => ({ medicationId: m.id, name: m.name, strength: m.strength })),
        createdAt: now,
      })
      .returning();

    let res: Response;
    try {
      res = await fetch(new URL('/pharmacy-calls', voiceUrl), {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          inquiryId: inquiry.id,
          familyId: ref.familyId,
          phone,
          medications: asked.map((m) => ({ name: m.name, dose: m.strength ?? undefined })),
        }),
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
    const [updated] = await this.db
      .update(pharmacyInquiries)
      .set({ sessionId: callId })
      .where(eq(pharmacyInquiries.id, inquiry.id))
      .returning();
    telemetry.capture(
      'pharmacy_call_requested',
      { inquiry_id: inquiry.id, call_id: callId, medications: asked.length, demo: ref.isDemo },
      ref.patientId,
    );
    this.logger.log(`Calling the pharmacy for inquiry ${inquiry.id} (${callId}).`);
    return this.view(updated, now);
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
    return row ? this.view(row, now) : null;
  }

  /** Stores what the pharmacy said. apps/voice retries the POST, so a finished inquiry is kept as is. */
  async applyResult(id: string, result: PharmacyVoiceResult) {
    const [row] = await this.db
      .update(pharmacyInquiries)
      .set({
        status: result.outcome,
        sessionId: result.sessionId,
        answers: result.items.map((i) => ({
          medication: i.medication,
          available: i.available,
          priceCents: i.priceCents,
          package: i.package ?? undefined,
          farmaciaPopular: i.farmaciaPopular,
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
      .returning({ id: pharmacyInquiries.id, familyId: pharmacyInquiries.familyId });
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
    return 'recorded' as const;
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
