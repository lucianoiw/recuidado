import { describe, expect, it } from "vitest";
import { assignRows, ceafIngredients, NEXT_PAGE, PREVIOUS_PAGE, type PdfRow } from "../src/fetch-ceaf.ts";
import { remumeAccess, remumeIngredients } from "../src/fetch-remume.ts";
import { isCeafPharmacy, isUbs } from "../src/fetch-sus-units.ts";
import { linkFreeAccess } from "../src/link-free-access.ts";
import { looseKey, looseMatchKey, parseStrengths } from "../src/lib/normalize.ts";
import type { CnesEstablishment } from "../src/lib/cnes.ts";

describe("REMUME", () => {
  it("drops the salt written after a comma and abbreviations in parentheses", () => {
    expect(remumeIngredients("anlodipino, besilato 5 mg comprimido")).toEqual(["anlodipino"]);
    expect(remumeIngredients("abacavir, sulfato (ABC) 300 mg comprimido")).toEqual(["abacavir"]);
    expect(remumeIngredients("levodopa 200 mg + benserazida 50 mg comprimido")).toEqual(["levodopa", "benserazida"]);
  });

  it("marks items of every UBS apart from reference services", () => {
    expect(remumeAccess("medicamento disponível nas Unidades de Saúde")).toBe("ubs");
    expect(remumeAccess("medicamento disponível em SAE/IST/AIDS Exclusivamente para pacientes em tratamento nestas unidades")).toBe("restricted");
    expect(remumeAccess("medicamento disponível nas Unidades de Saúde Exclusivamente para pacientes em tratamento na Rede")).toBe("restricted");
  });
});

describe("loose keys", () => {
  it("joins names written in different styles", () => {
    expect(looseKey(["dipropionato de beclometasona"])).toBe(looseKey(["beclometasona, dipropionato"]));
    expect(looseKey(["levodopa", "cloridrato de benserazida"])).toBe("benserazida + levodopa");
    expect(looseKey(["insulina análoga glargina"])).toBe("insulina glargina");
  });

  it("ignores /dose in inhaler strengths", () => {
    expect(looseMatchKey(["salbutamol"], parseStrengths("100 mcg/dose"))).toBe("salbutamol 100 mcg");
    expect(looseMatchKey(["salbutamol"], parseStrengths("SULFATO DE SALBUTAMOL 100MCG"))).toBe("salbutamol 100 mcg");
  });
});

describe("CEAF", () => {
  it("reads the ingredient from names with salts and page cuts", () => {
    expect(ceafIngredients("timolol (maleato de timolol)")).toEqual(["timolol"]);
    expect(ceafIngredients("de pilocarpina)")).toEqual(["pilocarpina"]);
    expect(ceafIngredients("fluticasona + umeclidínio + vilanterol (furoato de fluticasona + brometo de")).toEqual([
      "fluticasona", "umeclidínio", "vilanterol",
    ]);
  });

  it("assigns rows through the background band of each drug", () => {
    const row = (y: number): PdfRow => ({ y, top: y + 10, bottom: y - 10, presentation: "", component: "" });
    const rows = [row(470), row(400), row(360), row(80)];
    const names = [{ y: 380, text: "abatacepte" }];
    const bands = [
      { top: 489, bottom: 430 }, // continues from the previous page
      { top: 430, bottom: 330 },
      { top: 120, bottom: 60 }, // continues on the next page
    ];
    expect(assignRows(rows, names, bands)).toEqual([PREVIOUS_PAGE, 0, 0, NEXT_PAGE]);
  });
});

describe("SUS units", () => {
  const unit = (fantasy: string, legal = "") => ({ nome_fantasia: fantasy, nome_razao_social: legal }) as CnesEstablishment;
  it("keeps UBS and the state Alto Custo pharmacies", () => {
    expect(isUbs(unit("UBS HUMAITA DR JOAO DE AZEVEDO LAGE"))).toBe(true);
    expect(isUbs(unit("CLINICA ORTOPEDICA E TRAUM SERGIO RUDELLI"))).toBe(false);
    expect(isCeafPharmacy(unit("FARMACIA MEDEX DR GERALDO BOURROUL", "SECRETARIA DE ESTADO DA SAUDE DE SAO PAULO"))).toBe(true);
    expect(isCeafPharmacy(unit("DROGARIA SAO PAULO"))).toBe(false);
  });
});

describe("free access", () => {
  it("merges the three lists on the loose key", () => {
    const strengths = parseStrengths("50 mg");
    const rows = linkFreeAccess(
      [{ active_ingredients: ["losartana potássica"], strengths, name: "LOSARTANA POTÁSSICA 50MG", match_key: "losartana 50 mg" } as never],
      [{ active_ingredients: ["losartana"], strengths, name: "losartana 50 mg", match_key: "losartana 50 mg", loose_match_key: "losartana 50 mg", access: "ubs" } as never],
      [],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ farmacia_popular: true, ubs: true, ceaf: false });
  });
});
