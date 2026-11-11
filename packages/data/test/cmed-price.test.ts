import { describe, expect, it } from "vitest";
import { findCmedPrice } from "../src/cmed-price.ts";

describe("findCmedPrice", () => {
  it("prices a month of losartana 50 mg twice a day from the cheapest pack", () => {
    const price = findCmedPrice("Losartana potássica", "50 mg", 2);
    expect(price).not.toBeNull();
    expect(price!.presentations).toBeGreaterThan(10);
    expect(price!.monthlyCents).toBe(Math.round(price!.cheapest.perUnitCents * 60));
    expect(price!.monthlyMaxCents!).toBeGreaterThan(price!.monthlyCents!);
    expect(price!.listDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("matches salts and combinations written differently", () => {
    expect(findCmedPrice("Cloridrato de metformina", "850 mg", 1)).not.toBeNull();
    expect(findCmedPrice("levodopa + benserazida", "200 mg + 50 mg", 3)).not.toBeNull();
  });

  it("skips hospital packs when retail packs exist", () => {
    const price = findCmedPrice("Anlodipino", "5 mg", 1)!;
    expect(price.cheapest.unitsPerPack).toBeLessThanOrEqual(120);
  });

  it("has no monthly total without times and no price without a strength", () => {
    expect(findCmedPrice("Losartana potássica", "50 mg", 0)!.monthlyCents).toBeNull();
    expect(findCmedPrice("Losartana potássica", null, 1)).toBeNull();
    expect(findCmedPrice("Remédio inventado", "10 mg", 1)).toBeNull();
  });
});
