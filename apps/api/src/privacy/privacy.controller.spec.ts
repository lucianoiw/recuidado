import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { caregiverAuth, CAREGIVER, useFakeAuth } from '../auth/testing.js';
import { PrivacyController } from './privacy.controller.js';
import { PrivacyService } from './privacy.service.js';

const id = '11111111-1111-4111-8111-111111111111';

describe('PrivacyController', () => {
  let app: INestApplication;
  const setPatientConsent = vi.fn();
  const exportFamily = vi.fn();
  const deleteFamily = vi.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PrivacyController],
      providers: [{ provide: PrivacyService, useValue: { setPatientConsent, exportFamily, deleteFamily } }],
    }).compile();
    app = moduleRef.createNestApplication();
    useFakeAuth(app);
    await app.init();
  });

  afterAll(() => app.close());
  beforeEach(() => vi.clearAllMocks());

  it('saves her answer', async () => {
    await request(app.getHttpServer()).put(`/privacy/consent/${id}`).send({ accepted: false }).expect(204);
    expect(setPatientConsent).toHaveBeenCalledWith(id, false);
  });

  it('rejects a consent without an answer', async () => {
    await request(app.getHttpServer()).put(`/privacy/consent/${id}`).send({}).expect(400);
    expect(setPatientConsent).not.toHaveBeenCalled();
  });

  it('exports as a download that is not cached', async () => {
    exportFamily.mockResolvedValue({ family: { id } });
    const res = await request(app.getHttpServer()).get('/privacy/export').set('x-test-auth', caregiverAuth()).expect(200);
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(exportFamily).toHaveBeenCalledWith(CAREGIVER);
  });

  it('needs a signed-in caregiver to delete', async () => {
    await request(app.getHttpServer()).delete(`/privacy/family?caregiverId=${id}`).expect(401);
    await request(app.getHttpServer()).delete('/privacy/family').set('x-test-auth', caregiverAuth()).expect(204);
    expect(deleteFamily).toHaveBeenCalledWith(CAREGIVER);
  });
});
