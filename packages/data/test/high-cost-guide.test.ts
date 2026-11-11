import { describe, expect, it } from "vitest";
import { highCostGuide, slugFor } from "../src/high-cost-guide.ts";

const slugs = ["formoterol", "formoterol-budesonida", "sacubitril-valsartana-sodica-hidratada", "atorvastatina"];

describe("slugFor", () => {
  it("picks the shortest page that has every ingredient", () => {
    expect(slugFor("formoterol", slugs)).toBe("formoterol");
    expect(slugFor("budesonida + formoterol", slugs)).toBe("formoterol-budesonida");
  });
  it("ignores salts and how the combination is written", () => {
    expect(slugFor("sacubitril + valsartana sódica", slugs)).toBe("sacubitril-valsartana-sodica-hidratada");
    expect(slugFor("Sacubitril valsartana", slugs)).toBe("sacubitril-valsartana-sodica-hidratada");
  });
  it("returns null when no page matches", () => {
    expect(slugFor("losartana", slugs)).toBeNull();
  });
});

describe("highCostGuide", () => {
  it("uses the SES-SP leaflet when there is one", () => {
    const guide = highCostGuide("atorvastatina cálcica");
    expect(guide.specific).toBe(true);
    expect(guide.renewalMonths).toBe(6);
    expect(guide.leafletUrl).toMatch(/atorvastatina/);
    expect(guide.firstRequest.map((i) => i.id)).toContain("lme");
  });
  it("falls back to the general list with the medicine page", () => {
    const guide = highCostGuide("memantina");
    expect(guide.specific).toBe(false);
    expect(guide.renewalMonths).toBeNull();
    expect(guide.pageUrl).toMatch(/consulta-por-medicamento\/memantina$/);
    expect(guide.firstRequest.map((i) => i.id)).toEqual(["lme", "prescription", "exams", "id_document", "address", "sus_card"]);
  });
  it("keeps item ids unique within each list", () => {
    for (const name of ["atorvastatina", "donepezila", "sacubitril valsartana", "memantina"]) {
      const guide = highCostGuide(name);
      for (const list of [guide.firstRequest, guide.renewal]) {
        expect(new Set(list.map((i) => i.id)).size).toBe(list.length);
      }
    }
  });
});
