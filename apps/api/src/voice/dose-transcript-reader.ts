import type Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { TRANSCRIPT_READER_MODEL } from '../pharmacy/transcript-reader.js';

const ReadingSchema = z.object({
  taken: z.enum(['yes', 'no', 'unknown']),
  feels_unwell: z.enum(['yes', 'no', 'unknown']),
  emergency: z.boolean(),
  note: z.string(),
});

export interface DoseReading {
  taken: boolean | undefined;
  feelsUnwell: boolean | undefined;
  emergency: boolean;
  note: string | undefined;
}

const SYSTEM = [
  'You read the transcript of a phone call between a virtual assistant and an older patient in Brazil.',
  'The transcript comes from speech recognition and may be broken into small pieces: read them together.',
  'Report only what the patient said. Never guess.',
  'taken: "yes" only if she clearly said she already took the medicine (all of them, when there are several); "no" if she said she has not taken it yet, will not, or ran out; "unknown" if she did not say.',
  'feels_unwell: "yes" for any complaint (pain, dizziness, a fall, shortness of breath, tiredness, weakness, feeling sick or sad); "no" if she said she is fine or better, or someone from the family is with her; "unknown" if she did not say.',
  'emergency: true only for a possible emergency she reported: a fall, chest pain, shortness of breath, fainting, too weak to stand up, or asking for urgent help.',
  'note: what she reported, in Portuguese, as a short phrase in the third person without a subject, completing "ela falou que ..." (for example "já tomou e está bem"), or empty.',
].join('\n');

/**
 * Fallback when a call to the patient ended before the voice model recorded her answer:
 * reads the answer from the transcript, the same way the pharmacy calls do.
 */
export async function readDoseTranscript(
  client: Anthropic,
  transcript: { speaker: 'assistant' | 'patient'; text: string }[],
  opts: { checkIn?: boolean; model?: string } = {},
  onUsage?: (usage: { model: string; input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }) => void,
): Promise<DoseReading> {
  const model = opts.model ?? TRANSCRIPT_READER_MODEL;
  const lines = transcript.map((l) => `${l.speaker === 'patient' ? 'Paciente' : 'Assistente'}: ${l.text.trim()}`).join('\n');
  const topic = opts.checkIn
    ? 'This was a call back after she reported a possible emergency: it asks only how she is now, so taken is "unknown".'
    : 'The call asked how she is and whether she took the medicine of this dose.';
  const response = await client.beta.messages.create({
    model,
    max_tokens: 500,
    output_config: { format: betaZodOutputFormat(ReadingSchema) },
    system: SYSTEM,
    messages: [{ role: 'user', content: `${topic}\n\nTranscript:\n${lines}` }],
  });
  onUsage?.({ model: response.model ?? model, ...response.usage });
  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  const r = ReadingSchema.parse(JSON.parse(text));
  const tri = (v: 'yes' | 'no' | 'unknown') => (v === 'yes' ? true : v === 'no' ? false : undefined);
  return {
    taken: opts.checkIn ? undefined : tri(r.taken),
    feelsUnwell: r.emergency ? true : tri(r.feels_unwell),
    emergency: r.emergency,
    note: r.note.trim() || undefined,
  };
}
