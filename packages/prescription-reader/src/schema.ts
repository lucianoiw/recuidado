import { z } from "zod";

/**
 * Structured output returned by the model. Keys are in English (code convention);
 * free-text values keep the language written on the prescription (Portuguese).
 * Every field is required and nullable instead of optional, so the model must
 * explicitly say "unknown" (null) rather than silently dropping a field.
 */

export const StrengthSchema = z.object({
  value: z.number().nullable().describe("Numeric strength, e.g. 50 for '50 mg'. Null if not written."),
  unit: z
    .enum(["mg", "mcg", "g", "mL", "UI", "mg/mL", "UI/mL", "mcg/dose", "%", "other"])
    .nullable()
    .describe("Strength unit. Null if not written."),
  text: z.string().describe("Strength exactly as written, e.g. '850mg' or '100 UI/mL'. Empty string if absent."),
});

export const ScheduledDoseSchema = z.object({
  time: z.string().describe("24h time 'HH:MM' in the patient's local time."),
  amount: z.number().nullable().describe("Amount taken at this time, in dose_unit (e.g. 1 tablet, 10 UI)."),
  anchor: z
    .enum([
      "fixed_time",
      "wake_up",
      "morning",
      "before_breakfast",
      "breakfast",
      "after_breakfast",
      "before_lunch",
      "lunch",
      "after_lunch",
      "afternoon",
      "before_dinner",
      "dinner",
      "after_dinner",
      "night",
      "bedtime",
    ])
    .describe("What the prescription tied this dose to. 'fixed_time' for explicit hours or intervals."),
});

export const PrescriptionItemSchema = z.object({
  raw_text: z.string().describe("The full line(s) for this item, transcribed verbatim."),
  medication_name: z.string().describe("Name as written (brand or generic), e.g. 'Glifage XR'."),
  active_ingredient: z
    .string()
    .nullable()
    .describe(
      "Generic name (DCB, Portuguese, lowercase), including the salt when written or implied by the brand, e.g. 'cloridrato de metformina'. Null if it cannot be identified.",
    ),
  is_brand_name: z.boolean().describe("True when medication_name is a brand (nome comercial)."),
  strength: StrengthSchema,
  dosage_form: z
    .enum([
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
    ])
    .nullable(),
  route: z
    .enum(["oral", "sublingual", "subcutaneous", "intramuscular", "inhalation", "ophthalmic", "topical", "other"])
    .nullable(),
  dose_per_intake: z
    .number()
    .nullable()
    .describe("Typical amount per intake (e.g. 1). If amounts differ by time, use the schedule amounts."),
  dose_unit: z
    .enum(["tablet", "capsule", "mL", "drop", "UI", "puff", "application", "other"])
    .nullable(),
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
  quantity_prescribed: z.string().nullable().describe("Quantity to dispense as written, e.g. '60 comprimidos', '1 caixa'."),
  instructions: z.string().nullable().describe("Extra instructions as written, e.g. 'após o café', 'em jejum'."),
  confidence: z.enum(["high", "medium", "low"]),
  needs_review: z.boolean().describe("True when any field was guessed, illegible or ambiguous."),
  review_reason: z.string().nullable().describe("Short reason in Portuguese when needs_review is true."),
});

export const PrescriptionReadingSchema = z.object({
  is_prescription: z.boolean().describe("False when the image is not a medical prescription."),
  legibility: z.enum(["good", "partial", "poor"]),
  issued_on: z.string().nullable().describe("Issue date as 'YYYY-MM-DD'. Null if absent or illegible."),
  patient_name: z.string().nullable(),
  prescriber_name: z.string().nullable(),
  prescriber_registry: z.string().nullable().describe("e.g. 'CRM-SP 123456'."),
  items: z.array(PrescriptionItemSchema),
  other_instructions: z
    .array(z.string())
    .describe("Non-medication guidance on the prescription (diet, exercise, exams, return visit)."),
  warnings: z
    .array(z.string())
    .describe("Short notes in Portuguese for the family about anything unclear. Empty if none."),
});

export type Strength = z.infer<typeof StrengthSchema>;
export type ScheduledDose = z.infer<typeof ScheduledDoseSchema>;
export type PrescriptionItem = z.infer<typeof PrescriptionItemSchema>;
export type PrescriptionReading = z.infer<typeof PrescriptionReadingSchema>;
