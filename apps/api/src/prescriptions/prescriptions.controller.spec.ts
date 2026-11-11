import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrescriptionReadError } from '@recuidado/prescription-reader';
import request from 'supertest';
import { PrescriptionsController } from './prescriptions.controller.js';
import { PrescriptionsService } from './prescriptions.service.js';

describe('POST /prescriptions/parse', () => {
  let app: INestApplication;
  const parse = vi.fn();
  const confirm = vi.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PrescriptionsController],
      providers: [
        { provide: PrescriptionsService, useValue: { parse, confirm } },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());
  beforeEach(() => {
    parse.mockReset();
    confirm.mockReset();
  });

  it('passes the uploaded image to the reader and returns its result', async () => {
    const result = {
      reading: { items: [] },
      model: 'claude-opus-5-5',
      usage: { input_tokens: 1, output_tokens: 1 },
    };
    parse.mockResolvedValue(result);

    const res = await request(app.getHttpServer())
      .post('/prescriptions/parse')
      .attach('file', Buffer.from('png-bytes'), {
        filename: 'receita.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(result);
    const [input] = parse.mock.calls[0]!;
    expect(input.mediaType).toBe('image/png');
    expect(Buffer.from(input.data).toString()).toBe('png-bytes');
  });

  it('rejects a request without file', async () => {
    const res = await request(app.getHttpServer()).post('/prescriptions/parse');
    expect(res.status).toBe(400);
    expect(parse).not.toHaveBeenCalled();
  });

  it('rejects unsupported formats', async () => {
    const res = await request(app.getHttpServer())
      .post('/prescriptions/parse')
      .attach('file', Buffer.from('text'), {
        filename: 'receita.txt',
        contentType: 'text/plain',
      });
    expect(res.status).toBe(415);
  });

  it('confirms reviewed items', async () => {
    confirm.mockResolvedValue({ medications: [] });
    const body = {
      patientId: '6f1c2b8e-7a4d-4c3e-9b1a-2d5e8f0a1b2c',
      items: [
        {
          name: 'Losartana potássica',
          strength: '50 mg',
          times: ['08:00', '20:00'],
        },
      ],
    };
    const res = await request(app.getHttpServer())
      .post('/prescriptions/confirm')
      .send(body);
    expect(res.status).toBe(201);
    expect(confirm).toHaveBeenCalledWith({
      ...body,
      items: [{ ...body.items[0], activeIngredient: null }],
    });
  });

  it('rejects an invalid confirmation without calling the service', async () => {
    const res = await request(app.getHttpServer())
      .post('/prescriptions/confirm')
      .send({ patientId: 'x', items: [] });
    expect(res.status).toBe(400);
    expect(confirm).not.toHaveBeenCalled();
  });
});

describe('PrescriptionsController error mapping', () => {
  const file = { buffer: Buffer.from('jpg'), mimetype: 'image/jpeg', size: 3 };

  it.each([
    ['too_large', 413],
    ['unsupported_type', 415],
    ['refused', 422],
    ['truncated', 502],
    ['invalid_output', 502],
  ] as const)('maps %s to %i', async (code, status) => {
    const parse = vi.fn(async () => {
      throw new PrescriptionReadError(code, 'mensagem');
    });
    const controller = new PrescriptionsController({
      parse,
    } as unknown as PrescriptionsService);
    await expect(controller.parse(file)).rejects.toMatchObject({
      status,
      message: 'mensagem',
    });
  });

  it('lets unexpected errors through', async () => {
    const boom = new Error('boom');
    const controller = new PrescriptionsController({
      parse: vi.fn(async () => {
        throw boom;
      }),
    } as unknown as PrescriptionsService);
    await expect(controller.parse(file)).rejects.toBe(boom);
  });
});
