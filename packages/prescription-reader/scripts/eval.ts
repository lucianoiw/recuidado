/**
 * Runs the reader on every synthetic fixture and compares the fields the rest of
 * Recuidado depends on (match_key, schedule, as-needed, monthly units).
 * Calls the Claude API: needs ANTHROPIC_API_KEY and costs a few cents per run.
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPrescriptionFile, readPrescription } from "../src/index.ts";
import type { NormalizedItem } from "../src/normalize.ts";

interface ExpectedItem {
  match_key: string[];
  as_needed: boolean;
  continuous: boolean | null;
  schedule: [string, number][];
  monthly_units: number | null;
}

interface ExpectedReading {
  patient_name: string;
  issued_on: string;
  items: ExpectedItem[];
  min_other_instructions: number;
}

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const expected: Record<string, ExpectedReading> = JSON.parse(
  await readFile(join(fixturesDir, "expected.json"), "utf8"),
);

function compareItem(want: ExpectedItem, got: NormalizedItem | undefined): string[] {
  if (!got) return ["item missing"];
  const errors: string[] = [];
  if (!got.match_key || !want.match_key.includes(got.match_key)) {
    errors.push(`match_key: got "${got.match_key}", want one of ${JSON.stringify(want.match_key)}`);
  }
  if (got.frequency.as_needed !== want.as_needed) errors.push(`as_needed: got ${got.frequency.as_needed}`);
  if (want.continuous !== null && got.duration.continuous !== want.continuous) {
    errors.push(`continuous: got ${got.duration.continuous}`);
  }
  const gotSchedule = got.schedule.map((dose) => [dose.time, dose.amount ?? got.dose_per_intake]);
  if (JSON.stringify(gotSchedule) !== JSON.stringify(want.schedule)) {
    errors.push(`schedule: got ${JSON.stringify(gotSchedule)}, want ${JSON.stringify(want.schedule)}`);
  }
  if (got.monthly_units !== want.monthly_units) {
    errors.push(`monthly_units: got ${got.monthly_units}, want ${want.monthly_units}`);
  }
  return errors;
}

let failures = 0;
let inputTokens = 0;
let outputTokens = 0;

for (const [file, want] of Object.entries(expected)) {
  const started = Date.now();
  const { reading, usage, model } = await readPrescription(await loadPrescriptionFile(join(fixturesDir, file)));
  inputTokens += usage.input_tokens;
  outputTokens += usage.output_tokens;

  const errors: string[] = [];
  if (reading.patient_name !== want.patient_name) errors.push(`patient_name: got "${reading.patient_name}"`);
  if (reading.issued_on !== want.issued_on) errors.push(`issued_on: got "${reading.issued_on}"`);
  if (reading.items.length !== want.items.length) {
    errors.push(`items: got ${reading.items.length}, want ${want.items.length}`);
  }
  if (reading.other_instructions.length < want.min_other_instructions) {
    errors.push(`other_instructions: got ${reading.other_instructions.length}`);
  }
  // Items are matched by key so the order on the page does not matter.
  for (const wantItem of want.items) {
    const gotItem = reading.items.find((item) => item.match_key && wantItem.match_key.includes(item.match_key));
    errors.push(...compareItem(wantItem, gotItem ?? reading.items[want.items.indexOf(wantItem)]).map((e) => `${wantItem.match_key[0]}: ${e}`));
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`${errors.length === 0 ? "PASS" : "FAIL"} ${file} (${model}, ${seconds}s)`);
  for (const error of errors) console.log(`  - ${error}`);
  if (errors.length > 0) failures++;
}

console.log(`\ntokens: ${inputTokens} in, ${outputTokens} out`);
process.exit(failures > 0 ? 1 : 0);
