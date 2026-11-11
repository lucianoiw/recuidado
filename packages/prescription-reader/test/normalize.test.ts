import { describe, expect, it } from "vitest";
import { groupTime, normalizeIngredient, normalizeReading, normalizeTime, toMatchKey } from "../src/normalize.ts";
import { PrescriptionReadingSchema, type PrescriptionItem, type PrescriptionReading } from "../src/schema.ts";

function item(overrides: Partial<PrescriptionItem> = {}): PrescriptionItem {
  return {
    raw_text: "Losartana potássica 50 mg. Tomar 1 comprimido de 12 em 12 horas. Uso contínuo.",
    medication_name: "Losartana potássica",
    active_ingredient: "losartana potássica",
    is_brand_name: false,
    strength: { value: 50, unit: "mg", text: "50 mg" },
    dosage_form: "tablet",
    route: "oral",
    dose_per_intake: 1,
    dose_unit: "tablet",
    frequency: { times_per_day: 2, interval_hours: 12, as_needed: false, text: "de 12 em 12 horas" },
    schedule: [
      { time: "20:00", amount: 1, anchor: "fixed_time" },
      { time: "08:00", amount: 1, anchor: "fixed_time" },
    ],
    schedule_source: "inferred",
    duration: { continuous: true, days: null },
    quantity_prescribed: "60 comprimidos",
    instructions: null,
    confidence: "high",
    needs_review: false,
    review_reason: null,
    ...overrides,
  };
}

function reading(items: PrescriptionItem[]): PrescriptionReading {
  return {
    is_prescription: true,
    legibility: "good",
    issued_on: "2026-11-03",
    patient_name: "Maria Helena Duarte",
    prescriber_name: null,
    prescriber_registry: null,
    items,
    other_instructions: [],
    warnings: [],
  };
}

describe("normalizeIngredient", () => {
  it.each([
    ["Losartana Potássica", "losartana"],
    ["cloridrato de metformina", "metformina"],
    ["Rosuvastatina cálcica", "rosuvastatina"],
    ["dipirona monoidratada", "dipirona"],
    ["ácido acetilsalicílico", "acido acetilsalicilico"],
    ["besilato de anlodipino", "anlodipino"],
    ["insulina humana NPH", "insulina humana nph"],
  ])("%s -> %s", (input, output) => {
    expect(normalizeIngredient(input)).toBe(output);
  });
});

describe("toMatchKey", () => {
  it("joins ingredient and strength", () => {
    expect(toMatchKey(item())).toBe("losartana 50 mg");
  });
  it("lowercases concentration units", () => {
    expect(
      toMatchKey({ active_ingredient: "insulina humana NPH", strength: { value: 100, unit: "UI/mL", text: "100 UI/mL" } }),
    ).toBe("insulina humana nph 100 ui/ml");
  });
  it("is null without an active ingredient", () => {
    expect(toMatchKey(item({ active_ingredient: null }))).toBeNull();
  });
});

describe("normalizeTime", () => {
  it.each([
    ["8:00", "08:00"],
    ["08h", "08:00"],
    ["8h30", "08:30"],
    ["22:00", "22:00"],
    ["25:00", null],
    ["noite", null],
  ])("%s -> %s", (input, output) => {
    expect(normalizeTime(input)).toBe(output);
  });
});

describe("normalizeReading", () => {
  it("sorts the schedule and computes monthly units", () => {
    const [result] = normalizeReading(reading([item()])).items;
    expect(result!.schedule.map((dose) => dose.time)).toEqual(["08:00", "20:00"]);
    expect(result!.monthly_units).toBe(60);
    expect(result!.match_key).toBe("losartana 50 mg");
    expect(result!.needs_review).toBe(false);
  });

  it("fills a missing schedule from the interval", () => {
    const [result] = normalizeReading(reading([item({ schedule: [], schedule_source: "none" })])).items;
    expect(result!.schedule.map((dose) => dose.time)).toEqual(["08:00", "20:00"]);
    expect(result!.schedule_source).toBe("inferred");
  });

  it("keeps as-needed items without schedule and without monthly units", () => {
    const [result] = normalizeReading(
      reading([
        item({
          frequency: { times_per_day: null, interval_hours: 6, as_needed: true, text: "de 6/6h se dor" },
          schedule: [],
          schedule_source: "none",
          duration: { continuous: false, days: null },
        }),
      ]),
    ).items;
    expect(result!.schedule).toEqual([]);
    expect(result!.monthly_units).toBeNull();
    expect(result!.needs_review).toBe(false);
  });

  it("repairs an anchored dose with a malformed time and flags an unusable one", () => {
    const [result] = normalizeReading(
      reading([
        item({
          schedule: [
            { time: "after dinner", amount: 1, anchor: "after_dinner" },
            { time: "??", amount: 1, anchor: "fixed_time" },
          ],
        }),
      ]),
    ).items;
    expect(result!.schedule.map((dose) => dose.time)).toEqual(["20:00"]);
    expect(result!.needs_review).toBe(true);
    expect(result!.review_reason).toContain("Horário inválido");
  });

  it("uses per-time amounts for monthly units", () => {
    const [result] = normalizeReading(
      reading([item({ schedule: [{ time: "19:00", amount: 2, anchor: "dinner" }], dose_per_intake: 2 })]),
    ).items;
    expect(result!.monthly_units).toBe(60);
  });

  it("flags items without an identified active ingredient", () => {
    const normalized = normalizeReading(reading([item({ active_ingredient: null })]));
    expect(normalized.items[0]!.needs_review).toBe(true);
    expect(normalized.warnings.length).toBeGreaterThan(0);
  });
});

describe("grouping close times", () => {
  it.each([
    ["08:30", "08:00"],
    ["07:00", "08:00"],
    ["12:30", "12:00"],
    ["19:00", "20:00"],
    ["21:00", "20:00"],
    ["14:00", "14:00"],
    ["22:00", "22:00"],
    ["06:00", "06:00"],
  ])("groupTime(%s) is %s", (time, expected) => {
    expect(groupTime(time)).toBe(expected);
  });

  it("groups doses near 08:00, 12:00 and 20:00 on those times", () => {
    const [result] = normalizeReading(
      reading([
        item({
          schedule: [
            { time: "08:30", amount: 1, anchor: "fixed_time" },
            { time: "12:30", amount: 1, anchor: "after_lunch" },
            { time: "21:00", amount: 1, anchor: "night" },
          ],
        }),
      ]),
    ).items;
    expect(result!.schedule.map((dose) => dose.time)).toEqual(["08:00", "12:00", "20:00"]);
  });

  it("keeps fasting and before-meal times apart from the meal", () => {
    const [result] = normalizeReading(
      reading([
        item({
          schedule: [
            { time: "07:30", amount: 10, anchor: "before_breakfast" },
            { time: "19:30", amount: 6, anchor: "before_dinner" },
          ],
        }),
      ]),
    ).items;
    expect(result!.schedule.map((dose) => dose.time)).toEqual(["07:30", "19:30"]);
  });

  it("never merges two doses of the same medicine into one", () => {
    const [result] = normalizeReading(
      reading([
        item({
          schedule: [
            { time: "08:00", amount: 1, anchor: "fixed_time" },
            { time: "08:45", amount: 1, anchor: "fixed_time" },
          ],
        }),
      ]),
    ).items;
    expect(result!.schedule.map((dose) => [dose.time, dose.amount])).toEqual([
      ["08:00", 1],
      ["08:45", 1],
    ]);
  });

  it("puts with-meal and after-meal anchors on the anchor times", () => {
    const [result] = normalizeReading(
      reading([
        item({
          schedule: [
            { time: "x", amount: 1, anchor: "after_breakfast" },
            { time: "x", amount: 1, anchor: "dinner" },
          ],
        }),
      ]),
    ).items;
    expect(result!.schedule.map((dose) => dose.time)).toEqual(["08:00", "20:00"]);
  });
});

describe("PrescriptionReadingSchema", () => {
  it("accepts a valid reading", () => {
    expect(PrescriptionReadingSchema.safeParse(reading([item()])).success).toBe(true);
  });
});
