import { describe, expect, it } from "vitest";
import {
  buildIngredientKey,
  buildMatchKey,
  normalizeIngredient,
  parseBrazilianNumber,
  parseStrengths,
  parseUnitsPerPack,
} from "../src/lib/normalize.ts";

describe("normalizeIngredient (same cases as prescription-reader)", () => {
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

describe("parseStrengths", () => {
  it.each([
    ["LOSARTANA POTÁSSICA 50MG", [{ value: 50, unit: "mg" }]],
    ["etinilestradiol 0,03mg + levonorgestrel 0,15mg", [{ value: 0.03, unit: "mg" }, { value: 0.15, unit: "mg" }]],
    ["insulina humana 100ui/ml", [{ value: 100, unit: "ui/ml" }]],
    ["10 MG/G + 0,443 MG/G CREM DERM CT BG AL X 40 G", [{ value: 10, unit: "mg/g" }, { value: 0.443, unit: "mg/g" }]],
    ["dipropionato de beclometasona 50mcg/dose", [{ value: 50, unit: "mcg/dose" }]],
  ])("%s", (input, output) => {
    expect(parseStrengths(input)).toEqual(output);
  });
});

describe("buildMatchKey", () => {
  it("matches the prescription-reader format", () => {
    expect(buildMatchKey(["losartana potássica"], parseStrengths("50MG"))).toBe("losartana 50 mg");
    expect(buildMatchKey(["cloridrato de metformina"], parseStrengths("500 MG"))).toBe("metformina 500 mg");
  });
  it("pairs combinations", () => {
    expect(buildMatchKey(["carbidopa", "levodopa"], parseStrengths("25mg + 250mg"))).toBe(
      "carbidopa 25 mg + levodopa 250 mg",
    );
  });
  it("falls back to ingredients when strengths do not line up", () => {
    expect(buildMatchKey(["carbidopa", "levodopa"], [])).toBe("carbidopa + levodopa");
  });
  it("sorts the ingredient key", () => {
    expect(buildIngredientKey(["levodopa", "carbidopa"])).toBe("carbidopa + levodopa");
  });
});

describe("parseBrazilianNumber", () => {
  it.each([
    ["1234,56", 1234.56],
    ["1.234,56", 1234.56],
    ["54,23*", 54.23],
    ["", null],
    [null, null],
  ])("%s -> %s", (input, output) => {
    expect(parseBrazilianNumber(input)).toBe(output);
  });
});

describe("parseUnitsPerPack", () => {
  it.each([
    ["50 MG COM REV CT BL AL PLAS PVC/PVDC X 30", 30],
    ["25 MG COM CT 3 BL AL PLAS INC X 10", 30],
    ["SOL OR CT FR VD AMB X 100 ML", null],
    ["10 MG/G + 0,443 MG/G CREM DERM CT BG AL X 40 G", null],
  ])("%s -> %s", (input, output) => {
    expect(parseUnitsPerPack(input)).toBe(output);
  });
});
