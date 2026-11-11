import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Root of the @recuidado/data package. */
export const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
/** Raw downloads. Not versioned: they are large and can be fetched again. */
export const CACHE_DIR = join(PACKAGE_ROOT, ".cache");
/** Clean output that the API imports into Postgres. Versioned. */
export const SEED_DIR = join(PACKAGE_ROOT, "seed");
/** Files a person exports by hand from an official panel (optional input). */
export const RAW_DIR = join(PACKAGE_ROOT, "raw");

export function ensureDir(path: string): string {
  mkdirSync(path, { recursive: true });
  return path;
}

export function cachePath(name: string): string {
  return join(ensureDir(CACHE_DIR), name);
}

export function seedPath(name: string): string {
  return join(ensureDir(SEED_DIR), name);
}
