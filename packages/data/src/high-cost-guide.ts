/**
 * Runtime lookup over seed/ceaf-sp-guides.json: what the family needs to get a
 * medicine from the São Paulo high cost program (CEAF, "Alto Custo").
 *
 * The checklists are copied by hand from the SES-SP leaflets ("cartilhas") of
 * each medicine; medicines without one get the general list from the Ministry
 * plus the link to their SES-SP page. Nothing here is written by AI.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { looseKey } from "./lib/normalize.ts";
import { SEED_DIR } from "./lib/paths.ts";

export interface HighCostItem {
  /** Stable within a guide, e.g. "lme", "sus_card". Used to save what the family already has. */
  id: string;
  /** Who provides it: the doctor at the appointment, or the family. */
  who: "doctor" | "family";
  label: string;
  detail?: string;
}

export interface HighCostGuide {
  /** Disease of the SES-SP leaflet; null for the general list. */
  disease: string | null;
  /** SES-SP page of the medicine, or the list of all medicines when unknown. */
  pageUrl: string;
  /** PDF leaflet the checklist was copied from; null for the general list. */
  leafletUrl: string | null;
  /** ISO date the leaflet was last updated by SES-SP. */
  updatedOn: string | null;
  /** True when the items come from this medicine's leaflet, false for the general list. */
  specific: boolean;
  /** Days the LME form is valid to ask for the medicine, from the day the doctor filled it. */
  lmeValidDays: number;
  /** Months between renewals; null when the family must check the leaflet. */
  renewalMonths: number | null;
  firstRequest: HighCostItem[];
  renewal: HighCostItem[];
  notes: string[];
  /** Documents to let someone else pick it up. */
  representative: string[];
  sources: { ministry: string; lmeForm: string; stock: string };
}

interface Seed {
  source: { url: string; ministry: string; lme_form: string; stock: string };
  lme_valid_days: number;
  pages: Record<string, string>;
  guides: {
    slug: string;
    disease: string;
    pdf: string;
    updated_on: string;
    renewal_months: number;
    notes: string[];
    first: HighCostItem[];
    renewal: HighCostItem[];
  }[];
  general: { first: HighCostItem[]; renewal: HighCostItem[] };
  representative: string[];
}

let seed: Seed | null = null;

function load(path = join(SEED_DIR, "ceaf-sp-guides.json")): Seed {
  seed ??= JSON.parse(readFileSync(path, "utf8")) as Seed;
  return seed;
}

/**
 * SES-SP page slug for a medicine: every word of the active ingredients must be in
 * the slug, and the shortest slug wins ("formoterol" is not "formoterol-budesonida").
 */
export function slugFor(activeIngredient: string, slugs: string[]): string | null {
  const key = looseKey(activeIngredient.split("+").map((part) => part.trim()).filter(Boolean));
  if (!key) return null;
  const words = key.split(/[\s+]+/).filter(Boolean);
  const matches = slugs.filter((slug) => {
    const parts = slug.split("-");
    return words.every((word) => parts.includes(word));
  });
  return matches.sort((a, b) => a.split("-").length - b.split("-").length)[0] ?? null;
}

/** The path to get one medicine from the Alto Custo in São Paulo. */
export function highCostGuide(activeIngredient: string): HighCostGuide {
  const data = load();
  const slug = slugFor(activeIngredient, Object.keys(data.pages));
  const guide = slug ? data.guides.find((g) => g.slug === slug) : undefined;
  return {
    disease: guide?.disease ?? null,
    pageUrl: (slug && data.pages[slug]) || data.source.url,
    leafletUrl: guide?.pdf ?? null,
    updatedOn: guide?.updated_on ?? null,
    specific: Boolean(guide),
    lmeValidDays: data.lme_valid_days,
    renewalMonths: guide?.renewal_months ?? null,
    firstRequest: guide?.first ?? data.general.first,
    renewal: guide?.renewal ?? data.general.renewal,
    notes: guide?.notes ?? [],
    representative: data.representative,
    sources: { ministry: data.source.ministry, lmeForm: data.source.lme_form, stock: data.source.stock },
  };
}
