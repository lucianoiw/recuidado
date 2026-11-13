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
      generic_price_reais: z.number().nullable(),
      reference_price_reais: z.number().nullable(),
      price_reais: z.number().nullable(),
      package: z.string(),
    }),
  ),
  matches_offers: TriState,
  note: z.string(),
});

export interface TranscriptAnswer {
  medication: string;
  available: 'yes' | 'no' | 'unknown';
  priceCents: number | null;
  genericPriceCents: number | null;
  referencePriceCents: number | null;
  package?: string;
}

const SYSTEM = [
  'You read the transcript of a phone call between a virtual assistant and a pharmacy in Brazil.',
  'The assistant asked about stock and the box price of the generic and of the reference brand for some medicines.',
  'The transcript comes from speech recognition and the two sides may be interleaved in small pieces: read them together.',
  'Report only what the pharmacy side said. Never guess or compute a price: if no price was said, use null.',
  'The assistant repeats the prices back to confirm. If the pharmacy corrects a price, use the corrected one; if it agrees, the repeated price stands.',
  'generic_price_reais: box price of the generic. reference_price_reais: box price of the reference brand. price_reais: a box price said without saying which one. Each in reais or null.',
  'available: "yes" only if they said they have it now, "no" if not, "unknown" otherwise.',
  'package: what the box has as they said it (for example "caixa com 30 comprimidos"), or empty.',
  'matches_offers: "yes" if the pharmacy said they match (cobrem) a lower price from another pharmacy, "no" if they said they do not, "unknown" otherwise. Put any condition they gave in note.',
  'note: anything else useful for the family, in Portuguese, short, or empty.',
  'One item per medicine asked about, in the given order.',
].join('\n');

function cents(reais: number | null): number | null {
  return reais != null && Number.isFinite(reais) && reais > 0 ? Math.round(reais * 100) : null;
}

/** Generic and reference prices in cents; priceCents is the cheapest box said. */
function prices(generic: number | null, reference: number | null, other: number | null) {
  const genericPriceCents = cents(generic);
  const referencePriceCents = cents(reference);
  const said = [genericPriceCents, referencePriceCents, cents(other)].filter((c): c is number => c != null);
  return { priceCents: said.length ? Math.min(...said) : null, genericPriceCents, referencePriceCents };
}

/**
 * Fallback when the call ended before the voice model recorded the answer:
 * reads stock and prices from the call transcript.
 */
export async function readPharmacyTranscript(
  client: Anthropic,
  medications: string[],
  transcript: { speaker: 'assistant' | 'patient'; text: string }[],
  model = TRANSCRIPT_READER_MODEL,
): Promise<{ items: TranscriptAnswer[]; note: string | null; matchesOffers: 'yes' | 'no' | 'unknown' }> {
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
        ...prices(i.generic_price_reais, i.reference_price_reais, i.price_reais),
        package: i.package.trim() || undefined,
      })),
    note: parsed.note.trim() || null,
    matchesOffers: parsed.matches_offers,
  };
}
