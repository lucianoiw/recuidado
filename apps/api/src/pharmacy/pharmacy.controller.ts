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
import { FamilyId } from '../auth/auth.context.js';
import { z } from 'zod';
import { VoiceTokenGuard } from '../voice/voice-token.guard.js';
import { PharmacyService, type PharmacyVoiceResult } from './pharmacy.service.js';


function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException(z.prettifyError(result.error));
  return result.data;
}

const askBody = z.object({ medicationIds: z.array(z.uuid()).min(1).max(30) });

const triState = z.enum(['yes', 'no', 'unknown']);
const voiceResultBody = z.object({
  sessionId: z.string(),
  outcome: z.enum(['answered', 'unclear', 'no_answer', 'failed']),
  items: z
    .array(
      z.object({
        medication: z.string(),
        available: triState,
        priceCents: z.number().int().nonnegative().nullable(),
        genericPriceCents: z.number().int().nonnegative().nullish(),
        referencePriceCents: z.number().int().nonnegative().nullish(),
        package: z.string().nullish(),
      }),
    )
    .max(10)
    .default([]),
  note: z.string().nullish(),
  matchesOffers: triState.nullish(),
  keysPressed: z.array(z.string()).default([]),
  transcript: z
    .array(z.object({ speaker: z.enum(['assistant', 'patient']), text: z.string() }))
    .default([]),
  durationSeconds: z.number().nonnegative().nullish(),
  endReason: z.string().nullish(),
  error: z.string().nullish(),
});

@Controller('pharmacy-inquiries')
export class PharmacyController {
  constructor(private readonly pharmacy: PharmacyService) {}

  /** "Perguntar à farmácia": the voice agent calls the pharmacy about these medicines. */
  @Post()
  ask(@Body() body: unknown, @FamilyId({ write: true }) familyId: string | null) {
    return this.pharmacy.ask(familyId, parse(askBody, body).medicationIds);
  }

  /** The family's most recent round of pharmacy calls, polled by the screen while they ring. */
  @Get('latest')
  latest(@FamilyId() familyId: string | null) {
    return this.pharmacy.latest(familyId);
  }

  /** Called by apps/voice when the pharmacy call ends. */
  @Post(':id/voice-result')
  @HttpCode(200)
  @UseGuards(VoiceTokenGuard)
  async voiceResult(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const status = await this.pharmacy.applyResult(id, parse(voiceResultBody, body) as PharmacyVoiceResult);
    return { status };
  }
}
