import type Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

/** Fast, cheap model: reading a one-minute phone transcript needs no more. */
export const TRANSCRIPT_READER_MODEL = 'claude-sonnet-5-5';

const TriState = z.enum(['yes', 'no', 'unknown']);

const ReadingSchema = z.object({
  items: z.array(
    z.object({
      medication: z.string(),
      available: TriState,
      price_reais: z.number().nullable(),
      package: z.string(),
      farmacia_popular: TriState,
    }),
  ),
  note: z.string(),
});

export interface TranscriptAnswer {
  medication: string;
  available: 'yes' | 'no' | 'unknown';
  priceCents: number | null;
  package?: string;
  farmaciaPopular: 'yes' | 'no' | 'unknown';
}

const SYSTEM = [
  'You read the transcript of a phone call between a virtual assistant and a pharmacy in Brazil.',
  'The assistant asked about stock, the price of one box and Farmácia Popular for some medicines.',
  'The transcript comes from speech recognition and the two sides may be interleaved in small pieces: read them together.',
  'Report only what the pharmacy side said. Never guess or compute a price: if no price was said, use null.',
  'available: "yes" only if they said they have it now, "no" if not, "unknown" otherwise.',
  'farmacia_popular: "yes" if they said it can be taken through Farmácia Popular there, "no" if not, "unknown" otherwise.',
  'package: what the box has as they said it (for example "caixa com 30 comprimidos"), or empty.',
  'note: anything else useful for the family, in Portuguese, short, or empty.',
  'One item per medicine asked about, in the given order.',
].join('\n');

/**
 * Fallback when the call ended before the voice model recorded the answer:
 * reads stock, price and Farmácia Popular from the call transcript.
 */
export async function readPharmacyTranscript(
  client: Anthropic,
  medications: string[],
  transcript: { speaker: 'assistant' | 'patient'; text: string }[],
  model = TRANSCRIPT_READER_MODEL,
): Promise<{ items: TranscriptAnswer[]; note: string | null }> {
  const lines = transcript
    .map((l) => `${l.speaker === 'patient' ? 'Farmácia' : 'Assistente'}: ${l.text.trim()}`)
    .join('\n');
  const response = await client.beta.messages.create({
    model,
    max_tokens: 2000,
    output_config: { format: betaZodOutputFormat(ReadingSchema) },
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Medicines asked about, in order: ${medications.join('; ')}.\n\nTranscript:\n${lines}`,
      },
    ],
  });
  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  const parsed = ReadingSchema.parse(JSON.parse(text));
  return {
    items: parsed.items
      .filter((i) => i.medication.trim())
      .map((i) => ({
        medication: i.medication.trim(),
        available: i.available,
        priceCents:
          i.price_reais != null && Number.isFinite(i.price_reais) && i.price_reais > 0
            ? Math.round(i.price_reais * 100)
            : null,
        package: i.package.trim() || undefined,
        farmaciaPopular: i.farmacia_popular,
      })),
    note: parsed.note.trim() || null,
  };
}
