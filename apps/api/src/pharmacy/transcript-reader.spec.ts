import type Anthropic from '@anthropic-ai/sdk';
import { readPharmacyTranscript } from './transcript-reader.js';

function fakeClient(json: unknown) {
  const create = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify(json) }] });
  return { client: { beta: { messages: { create } } } as unknown as Anthropic, create };
}

describe('readPharmacyTranscript', () => {
  it('turns the reading into answers in cents and sends the interleaved transcript', async () => {
    const { client, create } = fakeClient({
      items: [
        {
          medication: 'Rosuvastatina 10 mg',
          available: 'yes',
          generic_price_reais: 32.5,
          reference_price_reais: 61.9,
          price_reais: null,
          package: 'caixa com 30 comprimidos',
        },
      ],
      note: '',
    });
    const result = await readPharmacyTranscript(client, ['Rosuvastatina 10 mg'], [
      { speaker: 'patient', text: 'custa trinta e' },
      { speaker: 'assistant', text: 'e quantos' },
      { speaker: 'patient', text: 'dois reais e cinquenta centavos' },
    ]);
    expect(result).toEqual({
      items: [
        {
          medication: 'Rosuvastatina 10 mg',
          available: 'yes',
          priceCents: 3250,
          genericPriceCents: 3250,
          referencePriceCents: 6190,
          package: 'caixa com 30 comprimidos',
        },
      ],
      note: null,
    });
    const content = create.mock.calls[0][0].messages[0].content as string;
    expect(content).toContain('Farmácia: custa trinta e\nAssistente: e quantos\nFarmácia: dois reais');
  });

  it('keeps a missing price as null', async () => {
    const { client } = fakeClient({
      items: [{ medication: 'Losartana', available: 'no', generic_price_reais: null, reference_price_reais: null, price_reais: null, package: '' }],
      note: 'Chega amanhã.',
    });
    const result = await readPharmacyTranscript(client, ['Losartana'], [{ speaker: 'patient', text: 'Não tem.' }]);
    expect(result.items[0]).toMatchObject({ priceCents: null, package: undefined });
    expect(result.note).toBe('Chega amanhã.');
  });
});
