import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { normalizeReading, type NormalizedReading } from "./normalize.ts";
import { SYSTEM_PROMPT, USER_INSTRUCTION } from "./prompt.ts";
import { fromModelReading, ModelReadingSchema } from "./model-schema.ts";

/**
 * Claude Opus 5.5: strongest vision model in the current lineup for reading
 * handwritten Portuguese, with native structured outputs; one call per
 * prescription keeps the cost to cents.
 */
export const DEFAULT_MODEL = "claude-opus-5-5";

export type PrescriptionMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif" | "application/pdf";

/** The API rejects images above 5 MB; phone photos should be resized before upload. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export interface PrescriptionInput {
  data: Buffer;
  mediaType: PrescriptionMediaType;
}

export interface ReadPrescriptionOptions {
  client?: Anthropic;
  model?: string;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
}

export interface ReadPrescriptionResult {
  reading: NormalizedReading;
  model: string;
  usage: { input_tokens: number; output_tokens: number };
}

export type PrescriptionReadErrorCode = "too_large" | "unsupported_type" | "refused" | "truncated" | "invalid_output";

export class PrescriptionReadError extends Error {
  constructor(
    readonly code: PrescriptionReadErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PrescriptionReadError";
  }
}

const MEDIA_TYPES_BY_EXTENSION: Record<string, PrescriptionMediaType> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
};

export async function loadPrescriptionFile(path: string): Promise<PrescriptionInput> {
  const mediaType = MEDIA_TYPES_BY_EXTENSION[extname(path).toLowerCase()];
  if (!mediaType) {
    throw new PrescriptionReadError("unsupported_type", `Formato não suportado: ${extname(path) || "sem extensão"}.`);
  }
  return { data: await readFile(path), mediaType };
}

function toContentBlock(input: PrescriptionInput): Anthropic.Beta.BetaContentBlockParam {
  const data = input.data.toString("base64");
  if (input.mediaType === "application/pdf") {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data } };
  }
  if (input.data.byteLength > MAX_IMAGE_BYTES) {
    throw new PrescriptionReadError("too_large", "A foto passa de 5 MB. Reduza a resolução antes de enviar.");
  }
  return { type: "image", source: { type: "base64", media_type: input.mediaType, data } };
}

/**
 * Reads one prescription (photo or PDF) and returns structured, normalized data.
 * The result is a transcription for the family to confirm, never a clinical decision.
 */
export async function readPrescription(
  input: PrescriptionInput,
  options: ReadPrescriptionOptions = {},
): Promise<ReadPrescriptionResult> {
  const client = options.client ?? new Anthropic();
  const model = options.model ?? DEFAULT_MODEL;

  // create() instead of parse(): parse() throws on an empty refusal body before
  // stop_reason can be checked, so the JSON is validated below with the same schema.
  const response = await client.beta.messages.create({
    model,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    // If a safety classifier declines, the API retries on Anthropic's recommended fallback model.
    fallbacks: "default",
    output_config: {
      effort: options.effort ?? "high",
      format: betaZodOutputFormat(ModelReadingSchema),
    },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [toContentBlock(input), { type: "text", text: USER_INSTRUCTION }],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new PrescriptionReadError("refused", "O modelo recusou ler esta imagem.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new PrescriptionReadError("truncated", "A resposta do modelo foi cortada antes do fim.");
  }
  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new PrescriptionReadError("invalid_output", "O modelo não devolveu um JSON válido.");
  }
  const parsed = ModelReadingSchema.safeParse(json);
  if (!parsed.success) {
    throw new PrescriptionReadError("invalid_output", `JSON fora do esquema: ${parsed.error.message}`);
  }

  return {
    reading: normalizeReading(fromModelReading(parsed.data)),
    model: response.model,
    usage: { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens },
  };
}
