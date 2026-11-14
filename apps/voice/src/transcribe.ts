import type { TranscriptLine } from "./reminder-call.js";

/** Speech to text with speaker labels, run on the recording after the call. */
export const TRANSCRIBE_MODEL = "gpt-4o-transcribe-diarize";

/** OpenAI accepts files up to 25 MB; the 16 kHz mono WAV of a 5-minute call is about 10 MB. */
export const MAX_RECORDING_BYTES = 25 * 1024 * 1024;

export interface DiarizedSegment {
  speaker: string;
  text: string;
  /** Seconds from the start of the recording. */
  start: number;
  end: number;
}

/** What our assistant always says first: the speaker who says it is the assistant. */
const ASSISTANT_WORDS = /recuidado|assistente virtual/i;

/**
 * Turns diarized segments into transcript lines. The assistant is the speaker who introduces itself as the
 * Recuidado virtual assistant; everyone else (the phone menu, the attendant, Dona Maria) is the other side.
 * Back-to-back pieces of the same side become one line.
 */
export function toLines(segments: DiarizedSegment[]): TranscriptLine[] {
  const assistant = segments.find((s) => ASSISTANT_WORDS.test(s.text))?.speaker;
  const lines: (TranscriptLine & { atMs: number })[] = [];
  for (const s of segments) {
    const text = s.text.trim();
    if (!text) continue;
    const speaker = s.speaker === assistant ? "assistant" : "patient";
    const last = lines.at(-1);
    if (last && last.speaker === speaker) last.text += ` ${text}`;
    else lines.push({ speaker, text, atMs: Math.max(0, Math.round(s.start * 1000)) });
  }
  return lines;
}

/** Transcribes a call recording (WAV) with speaker labels. Throws on an API error. */
export async function transcribeRecording(
  apiKey: string,
  wav: Uint8Array,
  model = TRANSCRIBE_MODEL,
): Promise<TranscriptLine[]> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(wav)], { type: "audio/wav" }), "call.wav");
  form.append("model", model);
  form.append("response_format", "diarized_json");
  form.append("chunking_strategy", "auto");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(110_000),
  });
  if (!res.ok) throw new Error(`transcription failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { segments?: DiarizedSegment[] };
  return toLines(body.segments ?? []);
}
