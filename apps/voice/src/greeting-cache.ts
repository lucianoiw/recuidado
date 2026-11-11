import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Raw mono PCM16LE at 24 kHz, the format GPT-Live reflects on the sideband and plays as a fixture. */
const BYTES_PER_SECOND = 24_000 * 2;

/**
 * The greeting as the Live voice said it on an earlier call, keyed by voice and exact line.
 * Playing it as a fixture when the call is answered removes the seconds the model takes to start talking.
 * Kept in memory and, when possible, in a directory so it survives restarts of the same container.
 */
export class GreetingCache {
  private readonly memory = new Map<string, Buffer>();

  constructor(private readonly dir?: string) {
    if (dir) {
      try {
        mkdirSync(dir, { recursive: true });
      } catch {
        this.dir = undefined;
      }
    }
  }

  private key(voice: string, line: string): string {
    return createHash("sha256").update(`${voice}\n${line}`).digest("hex").slice(0, 32);
  }

  get(voice: string, line: string): Buffer | undefined {
    const key = this.key(voice, line);
    const hit = this.memory.get(key);
    if (hit || !this.dir) return hit;
    try {
      const audio = readFileSync(join(this.dir, `${key}.pcm`));
      this.memory.set(key, audio);
      return audio;
    } catch {
      return undefined;
    }
  }

  /** Stores clips between 1 and 15 seconds; anything else is probably not the greeting. */
  set(voice: string, line: string, audio: Buffer): boolean {
    const seconds = audio.length / BYTES_PER_SECOND;
    if (seconds < 1 || seconds > 15) return false;
    const key = this.key(voice, line);
    this.memory.set(key, audio);
    if (this.dir) {
      try {
        writeFileSync(join(this.dir, `${key}.pcm`), audio);
      } catch {
        // Memory is enough.
      }
    }
    return true;
  }
}

/** Lowercase letters and digits only, to compare what was said with the expected line. */
export function normalizeSpeech(text: string): string {
  return text
    .replace(/\[[^\]]*\]/g, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
