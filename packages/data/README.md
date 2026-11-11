# @recuidado/data

Scripts that download public data from official sources and write clean seed
files for the API. Only public data: no patient or personal data. The demo
person (Dona Maria) is synthetic and lives in `apps/`, not here.

```bash
pnpm install
pnpm fetch:all        # free items, CMED, pharmacies, then the price link
pnpm test
```

Each script reads the official page, finds the newest file of the month and
caches raw downloads in `.cache/` (not versioned). Output goes to `seed/`
(versioned) so the app works without network.

## Datasets

| File | What it is | Official source |
| --- | --- | --- |
| `seed/pfpb-free-items.json` | The 39 medicines dispensed for free by the Farmácia Popular, grouped by drug and strength, with every barcode (EAN) | Ministério da Saúde, [Códigos de Barras PFPB](https://www.gov.br/saude/pt-br/composicao/sectics/farmacia-popular/codigos-de-barras), list of October 2026 |
| `seed/pfpb-free-eans.csv` | One row per barcode of a free product (657 rows) | same |
| `seed/cmed-pmc.csv.gz` | CMED price list: one row per presentation sold at retail (22,705 rows), with the PMC for São Paulo | Anvisa, [CMED, Listas de preços](https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/cmed/precos), list published on 09/11/2026 |
| `seed/pfpb-free-item-prices.csv` | Ceiling price (PMC) of each free item if bought: min, median, max and per unit. Base of the "economia" number | join of the two above by EAN |
| `seed/pharmacies.json` | 64 active pharmacies within 2 km of the demo centre, with address and coordinates | Ministério da Saúde, CNES via [API de Dados Abertos](https://apidadosabertos.saude.gov.br/cnes/estabelecimentos) |

The official list of the 41 free items (39 medicines plus geriatric diapers and
sanitary pads) is [this PDF](https://www.gov.br/saude/pt-br/composicao/sectics/farmacia-popular/arquivos/elenco-de-medicamentos-e-insumos-pfpb.pdf).
Diapers and pads have their own barcode lists and are out of scope.

## Joining with a prescription

Every drug row has a `match_key` in the same format as
`packages/prescription-reader` (`toMatchKey`): lowercase, no accents, salt words
removed, then the strength. Example: "Losartana Potássica 50 mg" becomes
`losartana 50 mg`. `normalizeIngredient` here is a copy of the one in
prescription-reader; keep both salt lists in sync.

- Combinations pair each ingredient with its strength:
  `carbidopa 25 mg + levodopa 250 mg`.
- `ingredient_key` drops the strength, for "same drug, other strength" lookups.
- Known gap: the Farmácia Popular writes NPH insulin as `insulina humana 100 ui/ml`
  while a prescription may say `insulina humana nph 100 ui/ml`. Match on
  `ingredient_key` prefix as a fallback.

## Price ceiling (CMED)

The PMC depends on the state ICMS rate. For São Paulo: 18% for medicines, 12% for
generics, 0% when CMED marks the product "ICMS 0%" (`icmsRateFor` in
`src/region.ts`). `pmc_region` is that value; `pmc_0`, `pmc_12` and `pmc_18` are
kept for reference. Hospital-only presentations have no PMC and are excluded.
`units_per_pack` is parsed from the presentation text ("X 30", "CT 3 BL X 10")
and is null for packs measured in ml or g.

## Demo region

The coordinator asked for the region with the most complete pharmacy base, and
not the real city of anyone in the team. Choice: **São Paulo (capital), 2 km
around Bela Vista**.

How it was chosen (`pnpm report:regions`): CNES lists 1,007 active pharmacies in
São Paulo, 1,003 with coordinates inside the city. For each neighbourhood we
took the median coordinate of its pharmacies and counted the pharmacies within
2 km. Bela Vista came first with 66. Pharmacies whose point is more than 2.5 km
from their own neighbourhood median are flagged `coordinates_suspect` and left
out.

### Limitation: Farmácia Popular accreditation

CNES does not say whether a pharmacy is accredited by the Farmácia Popular, and
the official list of accredited pharmacies is only a Qlik panel with no download
API. So `fp_accredited` is `null` until someone exports the panel to
`raw/pfpb-pharmacies.csv` (steps in `raw/README.md`). The open data set
"[MGDI] Programa Farmácia Popular do Brasil" on dadosabertos.saude.gov.br only has
counts of people served, not pharmacies.

## Proposed tables

Names follow the API conventions (English, snake_case). Suggested for
`apps/api/src/db/schema.ts`:

- `pfpb_free_items` (id, indication, name, active_ingredients text[], match_key, ingredient_key, reference_month)
- `pfpb_free_item_eans` (ean pk, item_id fk, product)
- `cmed_prices` (ggrem pk, ean, ean_2, ean_3, substance, product, presentation, laboratory, product_type, price_regime, pmc_region numeric, icms_rate_region, units_per_pack, pmc_region_per_unit, match_key, ingredient_key, published_on), index on ean and match_key
- `pharmacies` (cnes pk, cnpj, name, street, number, district, postal_code, city, state, lat, lng, opening_hours, fp_accredited boolean null)
