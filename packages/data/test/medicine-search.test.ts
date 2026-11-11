import { describe, expect, it } from "vitest";
import { expandGroupedStrengths, presentationForm, presentationStrength, searchMedicines } from "../src/medicine-search.ts";

describe("presentation parsing", () => {
  it("gives each number of a grouped strength its unit", () => {
    expect(expandGroupedStrengths("(5 + 100) MG CAP DURA")).toBe("5 MG + 100 MG CAP DURA");
    expect(presentationStrength("(50,0 + 5,0) MG COM REV CT BL AL/AL X 30")).toBe("50 mg + 5 mg");
    expect(presentationStrength("50 MG + 12,5 MG COM REV")).toBe("50 mg + 12,5 mg");
  });

  it("names the form in plain Portuguese", () => {
    expect(presentationForm("50 MG COM REV CT BL AL PLAS X 30")).toBe("comprimido revestido");
    expect(presentationForm("500 MG/ML SOL OR CT FR GOT PLAS X 20 ML")).toBe("gotas");
    expect(presentationForm("100 UI/ML SOL INJ CT 1 FA")).toBe("injetável");
  });
});

describe("searchMedicines", () => {
  it("finds a generic by the first letters, before its brands", () => {
    const [first] = searchMedicines("losar");
    expect(first?.name).toBe("Losartana potássica");
    expect(first?.kind).toBe("generic");
    const fifty = first?.strengths.find((s) => s.strength === "50 mg");
    expect(fifty?.freeAt).toContain("farmacia_popular");
  });

  it("finds a brand by name and links it to its active ingredient", () => {
    const [first] = searchMedicines("cozaar");
    expect(first).toMatchObject({ name: "Cozaar", kind: "brand", activeIngredient: "Losartana potássica" });
  });

  it("uses numbers to filter the strengths", () => {
    const [first] = searchMedicines("losartana 50");
    expect(first?.strengths.map((s) => s.strength)).toEqual(["50 mg"]);
  });

  it("ignores accents and case, and needs at least two letters", () => {
    expect(searchMedicines("DIPIRONA")[0]?.name).toMatch(/^Dipirona/);
    expect(searchMedicines("l")).toEqual([]);
    expect(searchMedicines("")).toEqual([]);
  });

  it("respects the limit", () => {
    expect(searchMedicines("ac", 3)).toHaveLength(3);
  });
});
