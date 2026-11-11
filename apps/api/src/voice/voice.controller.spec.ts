import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { VoiceController } from './voice.controller.js';
import { VoiceTokenGuard } from './voice-token.guard.js';
import { VoiceCallService } from './voice.service.js';

const TOKEN = 'test-token-0123456789';
const DOSE = '6f1c1b0e-7a51-4c55-9a43-2f2d0f8b9e10';

describe('VoiceController', () => {
  let app: INestApplication;
  const applyResult = vi.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [VoiceController],
      providers: [
        VoiceTokenGuard,
        { provide: VoiceCallService, useValue: { applyResult } },
        { provide: ConfigService, useValue: { get: (k: string) => (k === 'VOICE_API_TOKEN' ? TOKEN : undefined) } },
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
});
