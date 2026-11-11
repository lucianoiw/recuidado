/**
 * Official sources. Every dataset in seed/ comes from one of these pages.
 * The download links change every month, so the scripts read the page and
 * pick the newest file instead of hard-coding a URL.
 */
export const SOURCES = {
  /** Ministério da Saúde: barcodes (EAN) of every product dispensed for free by the Farmácia Popular. */
  pfpbBarcodesPage: (year: number) =>
    `https://www.gov.br/saude/pt-br/composicao/sectics/farmacia-popular/codigos-de-barras/${year}`,
  /** Ministério da Saúde: official list of the 41 free items (PDF, one page). */
  pfpbItemsPdf: "https://www.gov.br/saude/pt-br/composicao/sectics/farmacia-popular/arquivos/elenco-de-medicamentos-e-insumos-pfpb.pdf",
  /** Ministério da Saúde: official panel with the address of every accredited pharmacy (Qlik, no download API). */
  pfpbPharmacyPanel: "https://infoms.saude.gov.br/extensions/SEIDIGI_DEMAS_PFPB_ENDERECOS/index.html",
  /** Anvisa / CMED: monthly price list with Preço Fábrica and Preço Máximo ao Consumidor (PMC). */
  cmedPricesPage: "https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/cmed/precos",
  /** Ministério da Saúde / DEMAS: open API over CNES (registry of health establishments). */
  cnesEstablishments: "https://apidadosabertos.saude.gov.br/cnes/estabelecimentos",
} as const;

/** CNES establishment type for pharmacies ("Farmácia"). */
export const CNES_PHARMACY_TYPE = 43;
