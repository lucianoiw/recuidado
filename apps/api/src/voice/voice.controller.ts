import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { z } from 'zod';
import { VoiceTokenGuard } from './voice-token.guard.js';
import { type AlertCallResult, VoiceCallService, type VoiceResult } from '@recuidado/core';

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
  constructor(private readonly voice: VoiceCallService) {}

  /** Called by apps/voice when a reminder call ends. */
  @Post('doses/:id/voice-result')
  @HttpCode(200)
  async voiceResult(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const status = await this.voice.applyResult(id, parse(voiceResultSchema, body) as VoiceResult);
    return { status };
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
