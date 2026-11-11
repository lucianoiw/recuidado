import { describe, expect, it } from "vitest";
import { groupFreeItems, splitIngredients, type BarcodeRow } from "../src/fetch-free-items.ts";
import { linkPrices } from "../src/link-free-items-prices.ts";

const rows: BarcodeRow[] = [
  { product: "LOSARTANA POTÁSSICA 50MG", indication: "HIPERTENSÃO", ean: "7890000000001" },
  { product: "LOSARTANA POTÁSSICA 50MG", indication: "HIPERTENSÃO", ean: "7890000000002" },
  { product: "CLORIDRATO DE METFORMINA 500MG - AÇÃO PROLONGADA", indication: "DIABETES", ean: "7890000000003" },
  { product: "CLORIDRATO DE METFORMINA 500MG", indication: "DIABETES", ean: "7890000000004" },
  {
    product: "ETINILESTRADIOL 0,03MG + LEVONORGESTREL 0,15MG - CARTELA COM 21 COMPRIMIDOS",
    indication: "ANTICONCEPÇÃO",
    ean: "7890000000005",
  },
];

describe("splitIngredients", () => {
  it("cuts each part at its first digit", () => {
    expect(splitIngredients("CARBIDOPA 25MG + LEVODOPA 250MG")).toEqual(["carbidopa", "levodopa"]);
  });
});

describe("groupFreeItems", () => {
  const items = groupFreeItems(rows);
  it("groups EANs by drug and strength", () => {
    const losartana = items.find((item) => item.id === "losartana-50-mg")!;
    expect(losartana.match_key).toBe("losartana 50 mg");
    expect(losartana.ean_count).toBe(2);
  });
  it("keeps extended release as its own item", () => {
    expect(items.map((item) => item.id)).toContain("metformina-500-mg-acao-prolongada");
    expect(items.map((item) => item.id)).toContain("metformina-500-mg");
  });
  it("keeps pack sizes as variants", () => {
    const pill = items.find((item) => item.id.startsWith("etinilestradiol"))!;
    expect(pill.variants[0]!.detail).toBe("CARTELA COM 21 COMPRIMIDOS");
  });
});

describe("linkPrices", () => {
  it("joins by EAN and falls back to match_key", () => {
    const items = groupFreeItems(rows);
    const cmed = [
      { ean: "7890000000001", ean_2: "", ean_3: "", match_key: "losartana 50 mg", pmc_region: "20", pmc_region_per_unit: "0.6667", product: "A", presentation: "X 30" },
      { ean: "7890000000009", ean_2: "", ean_3: "", match_key: "losartana 50 mg", pmc_region: "40", pmc_region_per_unit: "1.3333", product: "B", presentation: "X 30" },
      { ean: "7899999999999", ean_2: "", ean_3: "", match_key: "metformina 500 mg", pmc_region: "10", pmc_region_per_unit: "", product: "C", presentation: "X 30" },
    ];
    const prices = linkPrices(items, cmed);
    const losartana = prices.find((p) => p.item_id === "losartana-50-mg")!;
    expect(losartana.matched_by).toBe("ean");
    expect(losartana.pmc_region_min).toBe(20);
    expect(prices.find((p) => p.item_id === "metformina-500-mg")!.matched_by).toBe("match_key");
  });
});
