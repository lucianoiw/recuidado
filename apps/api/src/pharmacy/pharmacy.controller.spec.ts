import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { VoiceTokenGuard } from '../voice/voice-token.guard.js';
import { PharmacyController } from './pharmacy.controller.js';
import { PharmacyService, pharmacyTargets } from './pharmacy.service.js';

const TOKEN = 'test-token-0123456789';
const INQUIRY = '6f1c1b0e-7a51-4c55-9a43-2f2d0f8b9e10';
const MED = '0b8a4c2e-1d3f-4a5b-8c7d-9e0f1a2b3c4d';

describe('PharmacyController', () => {
  let app: INestApplication;
  const ask = vi.fn();
  const applyResult = vi.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PharmacyController],
      providers: [
        VoiceTokenGuard,
        { provide: PharmacyService, useValue: { ask, applyResult, latest: vi.fn().mockResolvedValue({ inquiry: null, inquiries: [] }) } },
        { provide: ConfigService, useValue: { get: (k: string) => (k === 'VOICE_API_TOKEN' ? TOKEN : undefined) } },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());
  beforeEach(() => {
    ask.mockReset();
    applyResult.mockReset();
  });

  it('asks the pharmacy about the chosen medicines', async () => {
    ask.mockResolvedValue({ id: INQUIRY, status: 'calling' });
    const res = await request(app.getHttpServer()).post('/pharmacy-inquiries').send({ medicationIds: [MED] });
    expect(res.status).toBe(201);
    expect(ask).toHaveBeenCalledWith(null, [MED]);
  });

  it('never takes a phone number from the request', async () => {
    const res = await request(app.getHttpServer())
      .post('/pharmacy-inquiries')
      .send({ medicationIds: [MED], phone: '11912345678' });
    expect(res.status).toBe(201);
    expect(ask).toHaveBeenCalledWith(null, [MED]);
  });

  it('rejects an empty list', async () => {
    const res = await request(app.getHttpServer()).post('/pharmacy-inquiries').send({ medicationIds: [] });
    expect(res.status).toBe(400);
    expect(ask).not.toHaveBeenCalled();
  });

  it('returns null when there was no call yet', async () => {
    const res = await request(app.getHttpServer()).get('/pharmacy-inquiries/latest');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ inquiry: null, inquiries: [] });
  });

  const result = {
    sessionId: 'live_1',
    outcome: 'answered',
    items: [{ medication: 'Losartana 50 mg', available: 'yes', priceCents: 1890, package: 'caixa com 30' }],
    keysPressed: ['2'],
  };

  it('needs the voice token to record a result', async () => {
    const res = await request(app.getHttpServer()).post(`/pharmacy-inquiries/${INQUIRY}/voice-result`).send(result);
    expect(res.status).toBe(401);
    expect(applyResult).not.toHaveBeenCalled();
  });

  it('records the result', async () => {
    applyResult.mockResolvedValue('recorded');
    const res = await request(app.getHttpServer())
      .post(`/pharmacy-inquiries/${INQUIRY}/voice-result`)
      .set('authorization', `Bearer ${TOKEN}`)
      .send(result);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'recorded' });
    expect(applyResult).toHaveBeenCalledWith(INQUIRY, expect.objectContaining({ outcome: 'answered' }));
  });
});

describe('pharmacyTargets', () => {
  it('reads the list of simulated pharmacies', () => {
    expect(pharmacyTargets('Drogaria Vida|+5500000000011, Farmácia Central|+5500000000012', '+5500000000000', 'X')).toEqual([
      { name: 'Drogaria Vida', phone: '+5500000000011' },
      { name: 'Farmácia Central', phone: '+5500000000012' },
    ]);
  });

  it('falls back to the single pharmacy number', () => {
    expect(pharmacyTargets(undefined, '+5500000000000', undefined)).toEqual([
      { name: 'Farmácia de teste', phone: '+5500000000000' },
    ]);
    expect(pharmacyTargets('', undefined, undefined)).toEqual([]);
  });
});
