import { z } from "zod";
import type { PrescriptionItem, PrescriptionReading } from "./schema.ts";
import { ScheduledDoseSchema } from "./schema.ts";

/**
 * Schema sent to the model as structured output.
 *
 * The API accepts at most 16 parameters with union types (nullable counts as a
 * union). So here only numbers are nullable; unknown text is "" and unknown
 * enums are "unknown". fromModelReading() maps these back to null so the rest
 * of the code works with PrescriptionReading.
 */

/** Maximum number of union-typed parameters the structured outputs API accepts. */
export const MAX_UNION_PARAMETERS = 16;

const text = (description: string) => z.string().describe(`${description} Empty string if absent or illegible.`);
const choice = <const T extends readonly [string, ...string[]]>(values: T, description: string) =>
  z.enum([...values, "unknown"]).describe(`${description} "unknown" if absent or illegible.`);

const ModelItemSchema = z.object({
  raw_text: z.string().describe("The full line(s) for this item, transcribed verbatim."),
  medication_name: z.string().describe("Name as written (brand or generic), e.g. 'Glifage XR'."),
  active_ingredient: text(
    "Generic name (DCB, Portuguese, lowercase), including the salt when written or implied by the brand, e.g. 'cloridrato de metformina'. Empty when it cannot be identified with confidence.",
  ),
  is_brand_name: z.boolean().describe("True when medication_name is a brand (nome comercial)."),
  strength: z.object({
    value: z.number().nullable().describe("Numeric strength, e.g. 50 for '50 mg'. Null if not written."),
    unit: choice(["mg", "mcg", "g", "mL", "UI", "mg/mL", "UI/mL", "mcg/dose", "%", "other"], "Strength unit."),
    text: text("Strength exactly as written, e.g. '850mg' or '100 UI/mL'."),
  }),
  dosage_form: choice(
    [
      "tablet",
      "extended_release_tablet",
      "capsule",
      "oral_solution",
      "oral_suspension",
      "drops",
      "injection",
      "inhaler",
      "eye_drops",
      "topical",
      "other",
    ],
    "Dosage form.",
  ),
  route: choice(
    ["oral", "sublingual", "subcutaneous", "intramuscular", "inhalation", "ophthalmic", "topical", "other"],
    "Route of administration.",
  ),
  dose_per_intake: z
    .number()
    .nullable()
    .describe("Typical amount per intake (e.g. 1). If amounts differ by time, use the schedule amounts."),
  dose_unit: choice(["tablet", "capsule", "mL", "drop", "UI", "puff", "application", "other"], "Unit of the amount per intake."),
  frequency: z.object({
    times_per_day: z.number().nullable(),
    interval_hours: z.number().nullable().describe("e.g. 8 for '8/8h'. Null when not interval-based."),
    as_needed: z.boolean().describe("True for 'se necessário', 'se dor', 'S.O.S.'."),
    text: z.string().describe("Posology exactly as written, e.g. '1 cp de 12/12h'."),
  }),
  schedule: z
    .array(ScheduledDoseSchema)
    .describe("Concrete daily times. Empty for as-needed items or when frequency is unreadable."),
  schedule_source: z
    .enum(["explicit", "inferred", "none"])
    .describe("'explicit' if hours were written, 'inferred' if derived from the routine table, 'none' if empty."),
  duration: z.object({
    continuous: z.boolean().describe("True for 'uso contínuo'."),
    days: z.number().nullable().describe("Treatment length in days when written (e.g. 'por 7 dias')."),
  }),
  quantity_prescribed: text("Quantity to dispense as written, e.g. '60 comprimidos', '1 caixa'."),
  instructions: text("Extra instructions as written, e.g. 'após o café', 'em jejum'."),
  confidence: z.enum(["high", "medium", "low"]),
  needs_review: z.boolean().describe("True when any field was guessed, illegible or ambiguous."),
  review_reason: text("Short reason in Portuguese when needs_review is true."),
});

export const ModelReadingSchema = z.object({
  is_prescription: z.boolean().describe("False when the image is not a medical prescription."),
  legibility: z.enum(["good", "partial", "poor"]),
  issued_on: text("Issue date as 'YYYY-MM-DD'."),
  patient_name: text("Patient name as written."),
  prescriber_name: text("Prescriber name as written."),
  prescriber_registry: text("Prescriber registry, e.g. 'CRM-SP 123456'."),
  items: z.array(ModelItemSchema),
  other_instructions: z
    .array(z.string())
    .describe("Non-medication guidance on the prescription (diet, exercise, exams, return visit)."),
  warnings: z
    .array(z.string())
    .describe("Short notes in Portuguese for the family about anything unclear. Empty if none."),
});

export type ModelReading = z.infer<typeof ModelReadingSchema>;
type ModelItem = z.infer<typeof ModelItemSchema>;

const textOrNull = (value: string): string | null => (value.trim() === "" ? null : value.trim());
const choiceOrNull = <T extends string>(value: T | "unknown"): T | null => (value === "unknown" ? null : value);

function fromModelItem(item: ModelItem): PrescriptionItem {
  return {
    ...item,
    active_ingredient: textOrNull(item.active_ingredient),
    strength: { ...item.strength, unit: choiceOrNull(item.strength.unit) },
    dosage_form: choiceOrNull(item.dosage_form),
    route: choiceOrNull(item.route),
    dose_unit: choiceOrNull(item.dose_unit),
    quantity_prescribed: textOrNull(item.quantity_prescribed),
    instructions: textOrNull(item.instructions),
    review_reason: textOrNull(item.review_reason),
  };
}

/** Maps the model's "" and "unknown" placeholders back to null. */
export function fromModelReading(reading: ModelReading): PrescriptionReading {
  return {
    ...reading,
    issued_on: textOrNull(reading.issued_on),
    patient_name: textOrNull(reading.patient_name),
    prescriber_name: textOrNull(reading.prescriber_name),
    prescriber_registry: textOrNull(reading.prescriber_registry),
    items: reading.items.map(fromModelItem),
  };
}
