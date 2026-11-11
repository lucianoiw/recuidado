import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { FamilyController } from './family.controller.js';
import { FamilyService } from './family.service.js';

const body = {
  caregiver: { name: 'Ana', phone: '(11) 90000-0001', relation: 'Filho(a)', relationOther: '' },
  patient: {
    name: 'Maria Helena',
    nickname: 'Dona Maria',
    phone: '(11) 90000-0002',
    birth: '12/03/1958',
    cep: '01310-100',
    usesPhone: false,
  },
  invites: [{ name: 'Carlos', relation: 'Neto(a)' }],
};

describe('FamilyController', () => {
  let app: INestApplication;
  const saveOnboarding = vi.fn();
  const setBuyChoice = vi.fn();
  const join = vi.fn();
  const updateMedication = vi.fn();
  const removeMedication = vi.fn();
  const saveHighCost = vi.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [FamilyController],
      providers: [{ provide: FamilyService, useValue: { saveOnboarding, setBuyChoice, join, updateMedication, removeMedication, saveHighCost } }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());
  beforeEach(() => vi.resetAllMocks());

  it('normalizes the onboarding answers before saving', async () => {
    saveOnboarding.mockResolvedValue({ caregiverId: 'c1' });
    const res = await request(app.getHttpServer()).put('/family/onboarding').send(body);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ caregiverId: 'c1' });
    const [input] = saveOnboarding.mock.calls[0]!;
    expect(input.caregiver.phone).toBe('11900000001');
    expect(input.patient).toMatchObject({ phone: '11900000002', birth: '1958-03-12', cep: '01310100' });
    expect(input.invites).toEqual([{ name: 'Carlos', relation: 'Neto(a)' }]);
  });

  it('keeps the invite phone as digits', async () => {
    const res = await request(app.getHttpServer())
      .put('/family/onboarding')
      .send({ ...body, invites: [{ name: 'Carlos', relation: 'Neto(a)', phone: '(11) 98888-7777' }] });
    expect(res.status).toBe(200);
    const [input] = saveOnboarding.mock.calls.at(-1)!;
    expect(input.invites).toEqual([{ name: 'Carlos', relation: 'Neto(a)', phone: '11988887777' }]);
  });

  it('asks which relation when "Outro" has no text', async () => {
    const res = await request(app.getHttpServer())
      .put('/family/onboarding')
      .send({ ...body, caregiver: { ...body.caregiver, relation: 'Outro' } });
    expect(res.status).toBe(400);
    expect(saveOnboarding).not.toHaveBeenCalled();
  });

  it('rejects an invalid birth date', async () => {
    const res = await request(app.getHttpServer())
      .put('/family/onboarding')
      .send({ ...body, patient: { ...body.patient, birth: '31/02/1958' } });
    expect(res.status).toBe(400);
  });

  it('saves the buy choice of a medication', async () => {
    const id = '7f0c7c2e-2f7b-4a8e-9a43-0d2f1d6f3b11';
    const res = await request(app.getHttpServer())
      .put(`/family/medications/${id}/buy-choice`)
      .send({ buy: true });
    expect(res.status).toBe(204);
    expect(setBuyChoice).toHaveBeenCalledWith(null, id, true);
  });

  it('rejects a buy choice without boolean', async () => {
    const res = await request(app.getHttpServer())
      .put('/family/medications/7f0c7c2e-2f7b-4a8e-9a43-0d2f1d6f3b11/buy-choice')
      .send({ buy: 'yes' });
    expect(res.status).toBe(400);
  });

  it('updates the times of a medication', async () => {
    const id = '7f0c7c2e-2f7b-4a8e-9a43-0d2f1d6f3b11';
    const res = await request(app.getHttpServer())
      .patch(`/family/medications/${id}`)
      .send({ times: ['08:00', '20:00'] });
    expect(res.status).toBe(204);
    expect(updateMedication).toHaveBeenCalledWith(null, id, { times: ['08:00', '20:00'] });
  });

  it('rejects a time that is not HH:MM', async () => {
    const res = await request(app.getHttpServer())
      .patch('/family/medications/7f0c7c2e-2f7b-4a8e-9a43-0d2f1d6f3b11')
      .send({ times: ['8h'] });
    expect(res.status).toBe(400);
    expect(updateMedication).not.toHaveBeenCalled();
  });

  it('rejects an empty update', async () => {
    const res = await request(app.getHttpServer())
      .patch('/family/medications/7f0c7c2e-2f7b-4a8e-9a43-0d2f1d6f3b11')
      .send({});
    expect(res.status).toBe(400);
  });

  it('removes a medication', async () => {
    const id = '7f0c7c2e-2f7b-4a8e-9a43-0d2f1d6f3b11';
    const res = await request(app.getHttpServer()).delete(`/family/medications/${id}`);
    expect(res.status).toBe(204);
    expect(removeMedication).toHaveBeenCalledWith(null, id);
  });

  it('saves the Alto Custo checklist and dates', async () => {
    const id = '7f0c7c2e-2f7b-4a8e-9a43-0d2f1d6f3b11';
    const res = await request(app.getHttpServer())
      .put(`/family/medications/${id}/high-cost`)
      .send({ checked: ['lme', 'sus_card'], lmeFilledOn: '2026-11-10', since: null });
    expect(res.status).toBe(204);
    expect(saveHighCost).toHaveBeenCalledWith(null, id, {
      checked: ['lme', 'sus_card'],
      lmeFilledOn: '2026-11-10',
      since: null,
    });
  });

  it('rejects an Alto Custo date that is not a day', async () => {
    const res = await request(app.getHttpServer())
      .put('/family/medications/7f0c7c2e-2f7b-4a8e-9a43-0d2f1d6f3b11/high-cost')
      .send({ lmeFilledOn: '10/11/2026' });
    expect(res.status).toBe(400);
    expect(saveHighCost).not.toHaveBeenCalled();
  });

  it('passes the family of this device', async () => {
    const id = '7f0c7c2e-2f7b-4a8e-9a43-0d2f1d6f3b11';
    const familyId = '0b6f2a4c-9d1e-4f3a-8c2b-5e7d9a1b3c4d';
    const res = await request(app.getHttpServer()).delete(`/family/medications/${id}?familyId=${familyId}`);
    expect(res.status).toBe(204);
    expect(removeMedication).toHaveBeenCalledWith(familyId, id);
  });

  it('rejects a familyId that is not a uuid', async () => {
    const res = await request(app.getHttpServer()).get('/family?familyId=abc');
    expect(res.status).toBe(400);
  });
});
