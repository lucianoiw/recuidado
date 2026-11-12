import { findCmedPrice, presentationForm } from '@recuidado/data';

/** CMED reference sent with each medication in GET /family. */
export interface MedicationPrice {
  /** Cheapest presentation on the CMED list, for a month of doses. Null without fixed times. */
  monthlyCents: number | null;
  /** Most expensive presentation (usually the brand), for a month of doses. */
  monthlyMaxCents: number | null;
  /** Ceiling price (PMC, São Paulo) of the cheapest pack and its pills. */
  packCents: number;
  unitsPerPack: number;
  product: string;
  /** Publication date of the CMED list used. */
  listDate: string | null;
  /** Some pack with this substance and strength is sold as a generic. */
  hasGeneric: boolean;
  /** Pharmaceutical form of the cheapest pack, e.g. "comprimido revestido". */
  form: string | null;
  /** Prescription stripe on the box: red, black or none; null when the list does not say. */
  stripe: 'red' | 'black' | 'none' | null;
}

/**
 * CMED ceiling price for a medication, from the public list in @recuidado/data.
 * Never throws: a missing seed file only hides the price.
 */
export function cmedPriceOf(
  activeIngredient: string | null,
  name: string,
  strength: string | null,
  dosesPerDay: number,
): MedicationPrice | null {
  try {
    const price =
      (activeIngredient ? findCmedPrice(activeIngredient, strength, dosesPerDay) : null) ??
      findCmedPrice(name, strength, dosesPerDay);
    if (!price) return null;
    return {
      monthlyCents: price.monthlyCents,
      monthlyMaxCents: price.monthlyMaxCents,
      packCents: price.cheapest.packCents,
      unitsPerPack: price.cheapest.unitsPerPack,
      product: price.cheapest.product,
      listDate: price.listDate,
      hasGeneric: price.hasGeneric,
      form: presentationForm(price.cheapest.presentation),
      stripe: price.stripe,
    };
  } catch {
    return null;
  }
}

/** Monthly cost the screens use: a price the family saved wins over the CMED reference. */
export function monthlyCostOf(storedCents: number, price: MedicationPrice | null): number {
  return storedCents > 0 ? storedCents : (price?.monthlyCents ?? 0);
}
