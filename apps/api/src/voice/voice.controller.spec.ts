import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { VoiceController } from './voice.controller.js';
import { VoiceTokenGuard } from './voice-token.guard.js';
import { DB, VoiceCallService } from '@recuidado/core';

const TOKEN = 'test-token-0123456789';
const DOSE = '6f1c1b0e-7a51-4c55-9a43-2f2d0f8b9e10';

describe('VoiceController', () => {
  let app: INestApplication;
  const applyResult = vi.fn();
  const applyAlertCallResult = vi.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [VoiceController],
      providers: [
        VoiceTokenGuard,
        { provide: VoiceCallService, useValue: { applyResult, applyAlertCallResult } },
        { provide: ConfigService, useValue: { get: (k: string) => (k === 'VOICE_API_TOKEN' ? TOKEN : undefined) } },
        { provide: DB, useValue: {} },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());
  beforeEach(() => applyResult.mockReset());

  const result = { sessionId: 'live_1', outcome: 'not_taken', confirmed: false, note: 'acabou o remédio' };

  it('rejects a request without the voice token', async () => {
    const res = await request(app.getHttpServer()).post(`/doses/${DOSE}/voice-result`).send(result);
    expect(res.status).toBe(401);
    expect(applyResult).not.toHaveBeenCalled();
  });

  it('records the result', async () => {
    applyResult.mockResolvedValue('missed');
    const res = await request(app.getHttpServer())
      .post(`/doses/${DOSE}/voice-result`)
      .set('authorization', `Bearer ${TOKEN}`)
      .send(result);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'missed' });
    expect(applyResult).toHaveBeenCalledWith(DOSE, expect.objectContaining(result));
  });

  it('rejects an invalid body', async () => {
    const res = await request(app.getHttpServer())
      .post(`/doses/${DOSE}/voice-result`)
      .set('authorization', `Bearer ${TOKEN}`)
      .send({ outcome: 'maybe' });
    expect(res.status).toBe(400);
  });

  it('passes how an emergency call to a caregiver ended', async () => {
    applyAlertCallResult.mockResolvedValue('next');
    const body = {
      sessionId: 'live_alert',
      memberId: '0b4c1a7e-2f5d-4c3e-9b1a-7d6e5f4c3b2a',
      message: 'Olá, aqui é a assistente virtual da Recuidado.',
      answered: false,
      delivered: false,
    };
    const res = await request(app.getHttpServer())
      .post(`/doses/${DOSE}/alert-call-result`)
      .set('authorization', `Bearer ${TOKEN}`)
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'next' });
    expect(applyAlertCallResult).toHaveBeenCalledWith(DOSE, body);
  });
});
