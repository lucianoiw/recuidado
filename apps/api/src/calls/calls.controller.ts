import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  PayloadTooLargeException,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { VoiceTokenGuard } from '../voice/voice-token.guard.js';
import { CallsService, type CallLogInput } from './calls.service.js';

const SESSION_ID = /^[A-Za-z0-9_-]{6,120}$/;
const MAX_RECORDING_BYTES = 25 * 1024 * 1024;

const callLogSchema = z.object({
  sessionId: z.string().regex(SESSION_ID),
  kind: z.enum(['reminder', 'recall', 'check_in', 'caregiver', 'pharmacy']),
  doseId: z.uuid().nullish(),
  inquiryId: z.uuid().nullish(),
  outcome: z.string().max(60).nullish(),
  durationSeconds: z.number().nonnegative().nullish(),
  startedAt: z.iso.datetime().nullish(),
  transcript: z.array(z.object({ speaker: z.string().max(20), text: z.string().max(4000) })).max(400).default([]),
  events: z.array(z.object({ atMs: z.number().nonnegative(), text: z.string().max(2000) })).max(500).default([]),
});

function sessionParam(id: string): string {
  if (!SESSION_ID.test(id)) throw new BadRequestException('Ligação inválida.');
  return id;
}

async function readBody(req: Request): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_RECORDING_BYTES) throw new PayloadTooLargeException();
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/** The calls panel: apps/voice and Asterisk write (shared token); the demo family's calls are public. */
@Controller('call-logs')
export class CallsController {
  constructor(private readonly calls: CallsService) {}

  @Post()
  @HttpCode(204)
  @SkipThrottle()
  @UseGuards(VoiceTokenGuard)
  async saveLog(@Body() body: unknown) {
    const parsed = callLogSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(z.prettifyError(parsed.error));
    await this.calls.saveLog(parsed.data as CallLogInput);
  }

  /** Asterisk posts the WAV of a call when the call ends (deploy/asterisk/upload-recording.sh). */
  @Post(':sessionId/recording')
  @HttpCode(204)
  @SkipThrottle()
  @UseGuards(VoiceTokenGuard)
  async saveRecording(@Param('sessionId') sessionId: string, @Req() req: Request) {
    const audio = await readBody(req);
    if (audio.length < 44) throw new BadRequestException('Gravação vazia.');
    await this.calls.saveRecording(sessionParam(sessionId), audio);
  }

  @Get()
  list(@Query('limit') limit?: string) {
    return this.calls.listDemo(limit ? Number(limit) || 30 : 30);
  }

  @Get(':sessionId/recording')
  async recording(@Param('sessionId') sessionId: string, @Res() res: Response) {
    const found = await this.calls.recording(sessionParam(sessionId));
    if ('url' in found) return res.redirect(302, found.url);
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(found.audio);
  }
}
