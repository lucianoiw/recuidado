import { describe, expect, it } from "vitest";
import { readCsv } from "../src/lib/csv.ts";
import { parseStrengths } from "../src/lib/normalize.ts";
import { SEED_DIR } from "../src/lib/paths.ts";
import { checkRule, seedProgramIndex, strengthVariants } from "../src/programs.ts";
import { buildCoverage, summarize } from "../src/report-coverage.ts";
import { join } from "node:path";

describe("program index", () => {
  const index = seedProgramIndex();

  it("matches eye drops and sprays written per ml or per dose", () => {
    expect(index.find("Maleato de timolol", "5 mg/ml").freeAt).toContain("farmacia_popular");
    expect(index.find("Brometo de ipratrópio", "20 mcg/dose").freeAt).toContain("farmacia_popular");
    expect(strengthVariants(parseStrengths("20 mcg/dose")).map((v) => v.map((s) => `${s.value} ${s.unit}`))).toEqual([
      ["20 mcg/dose"],
      ["20 mcg"],
      ["0.02 mg"],
    ]);
  });

  it("checks the Farmácia Popular age rule of dapagliflozina", () => {
    expect(index.find("Dapagliflozina", "10 mg", null, { age: 78 }).freeAt).toContain("farmacia_popular");
    expect(index.find("Dapagliflozina", "10 mg", null, { age: 60 }).freeAt).not.toContain("farmacia_popular");
    expect(checkRule({ kind: "residence", value: "35", text: "SP" }, { cityIbge: "3550308" }).status).toBe("yes");
  });

  it("gives Alto Custo diseases and CID codes", () => {
    const access = index.find("sacubitril + valsartana", "97 mg + 103 mg");
    expect(access.highCost).toBe(true);
    expect(access.highCostConditions.length).toBeGreaterThan(0);
  });
});

describe("coverage map", () => {
  it("places every CMED medicine in one bucket", () => {
    const entries = buildCoverage(readCsv(join(SEED_DIR, "cmed-pmc.csv.gz")));
    const totals = summarize(entries);
    expect(totals.freePlain + totals.freeRestricted + totals.highCostOnly + totals.buy).toBe(totals.activeIngredients);
    expect(totals.atFarmaciaPopular).toBeGreaterThanOrEqual(25);
    expect(totals.highCostAny).toBeGreaterThan(150);
  });
});
