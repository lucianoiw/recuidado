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
  /** Prefeitura de São Paulo (SMS): REMUME page, links the PDF of medicines handed out for free in the municipal network. */
  remumePage: "https://prefeitura.sp.gov.br/web/saude/w/atencao_basica/rela%C3%A7%C3%A3o-municipal-de-medicamentos-remume",
  /** Ministério da Saúde: CEAF ("alto custo") overview, access rules (LME + PCDT). */
  ceafPage: "https://www.gov.br/saude/pt-br/composicao/sectics/daf/ceaf",
  /**
   * Secretaria de Saúde do Espírito Santo: REMEME, a full list that tags every
   * national CEAF item as "Especializado - Grupo 1A/1B/2 (CEAF/RENAME)". Groups 1
   * and 2 are defined nationally, so the tagged rows are the CEAF list in any state.
   * Used because the São Paulo state list (saude.sp.gov.br) did not answer from our
   * network on 11/11/2026. Replace the file name when ES publishes a new edition.
   */
  ceafListPdf: "https://farmaciacidada.es.gov.br/media/Arquivos/Componente%20Especializado/REMEME/REMEME_17.0_jan.2026.pdf",
  /**
   * SES-SP, Remédio SP: public list of the state's specialised medicines, one row per presentation
   * and CID, with the protocol name, CEAF group and age notes. No login.
   */
  remedioSpApi: "https://msrec.sp.gov.br/medex/acessos-publicos/medicamentos",
  /** Ministério da Saúde / DEMAS: open API over CNES (registry of health establishments). */
  cnesEstablishments: "https://apidadosabertos.saude.gov.br/cnes/estabelecimentos",
} as const;

/** CNES establishment type for pharmacies ("Farmácia"). */
export const CNES_PHARMACY_TYPE = 43;
/** CNES establishment type for UBS ("Centro de Saúde/Unidade Básica"). */
export const CNES_UBS_TYPE = 2;
