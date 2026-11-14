import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { z } from 'zod';
import { VoiceTokenGuard } from './voice-token.guard.js';
import Anthropic from '@anthropic-ai/sdk';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import {
  type AlertCallResult,
  type Database,
  DB,
  doses,
  medications,
  members,
  telemetry,
  VoiceCallService,
  type VoiceResult,
} from '@recuidado/core';
import { readDoseTranscript } from './dose-transcript-reader.js';

const voiceResultSchema = z.object({
  sessionId: z.string(),
  outcome: z.enum(['confirmed', 'not_taken', 'unclear', 'no_answer', 'failed']),
  confirmed: z.boolean(),
  note: z.string().nullish(),
  feelsUnwell: z.boolean().nullish(),
  emergency: z.boolean().nullish(),
  checkIn: z.boolean().nullish(),
  recall: z.boolean().nullish(),
  transcript: z
    .array(z.object({ speaker: z.enum(['assistant', 'patient']), text: z.string() }))
    .default([]),
  durationSeconds: z.number().nonnegative().nullish(),
  endReason: z.string().nullish(),
  error: z.string().nullish(),
});

const alertCallResultSchema = z.object({
  sessionId: z.string().min(1),
  memberId: z.uuid(),
  message: z.string().min(1).max(600),
  answered: z.boolean(),
  delivered: z.boolean(),
});

const demoSchema = z.object({
  phone: z.string().min(10),
  patientName: z.string().default('Maria'),
  medication: z.string().default('Losartana'),
  strength: z.string().default('50 mg'),
  // Phone of the demo son (first caregiver), who gets the emergency call.
  caregiverPhone: z.string().min(10).optional(),
});

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new BadRequestException(z.prettifyError(parsed.error));
  return parsed.data;
}

// Only apps/voice calls these, with the shared token.
@SkipThrottle()
@Controller()
@UseGuards(VoiceTokenGuard)
export class VoiceController {
  private readonly logger = new Logger(VoiceController.name);
  private client: Anthropic | undefined;

  constructor(
    private readonly voice: VoiceCallService,
    private readonly config: ConfigService,
    @Inject(DB) private readonly db: Database,
  ) {}

  /** Called by apps/voice when a reminder call ends. */
  @Post('doses/:id/voice-result')
  @HttpCode(200)
  async voiceResult(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const result = await this.fillFromTranscript(id, parse(voiceResultSchema, body) as VoiceResult);
    const status = await this.voice.applyResult(id, result);
    return { status };
  }

  /**
   * She answered but the voice model did not record her answer before the call ended: Claude reads the
   * transcript, as the pharmacy calls do. "Did not record" never turns into "she is not well".
   * Never throws: on any problem the result goes on unchanged.
   */
  private async fillFromTranscript(doseId: string, result: VoiceResult): Promise<VoiceResult> {
    if (result.outcome !== 'unclear') return result;
    const transcript = result.transcript ?? [];
    if (!transcript.some((l) => l.speaker === 'patient' && l.text.trim())) return result;
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) return result;
    const started = performance.now();
    try {
      const [row] = await this.db
        .select({ familyId: members.familyId })
        .from(doses)
        .innerJoin(medications, eq(doses.medicationId, medications.id))
        .innerJoin(members, eq(medications.patientId, members.id))
        .where(eq(doses.id, doseId));
      this.client ??= new Anthropic({ apiKey });
      const reading = await readDoseTranscript(this.client, transcript, { checkIn: Boolean(result.checkIn) }, (u) =>
        // Cost per family. LGPD: only the size of the transcript goes, not what she said.
        telemetry.llmGeneration({
          traceId: result.sessionId,
          spanName: 'dose_transcript_read',
          provider: 'anthropic',
          model: u.model,
          latencySeconds: (performance.now() - started) / 1000,
          input: [{ role: 'user', content: `[transcrição com ${transcript.length} falas]` }],
          inputTokens: u.input_tokens,
          outputTokens: u.output_tokens,
          cacheReadTokens: u.cache_read_input_tokens ?? undefined,
          cacheWriteTokens: u.cache_creation_input_tokens ?? undefined,
          familyId: row?.familyId ?? undefined,
          distinctId: row?.familyId ?? undefined,
          properties: { dose_id: doseId },
        }),
      );
      telemetry.capture('dose_answer_from_transcript', {
        dose_id: doseId,
        call_id: result.sessionId,
        taken: reading.taken ?? null,
        feels_unwell: reading.feelsUnwell ?? null,
        emergency: reading.emergency,
      });
      const outcome = reading.taken === true ? 'confirmed' : reading.taken === false ? 'not_taken' : 'unclear';
      return {
        ...result,
        outcome,
        confirmed: outcome === 'confirmed',
        feelsUnwell: reading.feelsUnwell,
        emergency: reading.emergency || undefined,
        note: reading.note ?? result.note,
      };
    } catch (error) {
      this.logger.warn(`reading dose transcript failed: ${(error as Error).message}`);
      return result;
    }
  }

  /** Called by apps/voice when an emergency call to a caregiver ends; not heard calls the next one. */
  @Post('doses/:id/alert-call-result')
  @HttpCode(200)
  async alertCallResult(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const status = await this.voice.applyAlertCallResult(id, parse(alertCallResultSchema, body) as AlertCallResult);
    return { status };
  }

  /** Demo: creates a pending dose for a synthetic patient and calls right away. */
  @Post('demo/missed-dose')
  async demoMissedDose(@Body() body: unknown) {
    const input = parse(demoSchema, body);
    const doseId = await this.voice.createDemoDose(input);
    const call = await this.voice.call(doseId);
    return { doseId, callId: call?.callId ?? null };
  }

  @Get('doses/:id/voice-calls')
  listCalls(@Param('id', ParseUUIDPipe) id: string) {
    return this.voice.listCalls(id);
  }

  @Get('demo/doses/:id')
  getDose(@Param('id', ParseUUIDPipe) id: string) {
    return this.voice.getDose(id);
  }
}
