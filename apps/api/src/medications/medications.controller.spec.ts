import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { MedicationsController } from './medications.controller.js';

describe('MedicationsController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [MedicationsController] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('GET /medications/search returns generics and brands with strengths', async () => {
    const res = await request(app.getHttpServer()).get('/medications/search?q=losar&limit=5').expect(200);
    expect(res.body).toHaveLength(5);
    expect(res.body[0]).toMatchObject({ name: 'Losartana potássica', kind: 'generic', laboratory: null });
    expect(res.body[0].strengths).toContainEqual({
      strength: '50 mg',
      form: 'comprimido revestido',
      freeAt: ['farmacia_popular', 'ubs'],
      highCost: false,
      farmaciaPopularRule: null,
    });
  });

  it('GET /medications/search returns an empty list for a short query', async () => {
    const res = await request(app.getHttpServer()).get('/medications/search?q=l').expect(200);
    expect(res.body).toEqual([]);
  });
});
