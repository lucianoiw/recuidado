/**
 * Text for the drawn medicine box on the family screens, from the saved medication.
 * Generics are sold by the short name ("Losartana", "Dipirona") with the full substance
 * below ("losartana potássica"); a brand keeps its own name.
 */
export interface MedicationBox {
  /** Big name on the box: "Losartana", "Sacubitril Valsartana", "Entresto". */
  title: string;
  /** Substance under the name: "losartana potássica", "sacubitril + valsartana sódica". */
  substance: string | null;
  /** Sold by the substance name and a generic of it exists: the box gets the yellow "G" band. */
  generic: boolean;
}

/** Salt and hydrate words that the box name leaves out. */
const SALT_BEFORE = /^(cloridrato|dicloridrato|besilato|maleato|succinato|hemifumarato|fumarato|mesilato|fosfato|sulfato|citrato|acetato|tartarato|bromidrato|valerato|propionato|dipropionato|furoato|nitrato|carbonato|levotiroxina sódica)\s+de\s+/i;
const SALT_AFTER = /\s+(potássica|potássico|sódica|sódico|cálcica|cálcico|magnésica|magnésico|monoidratada|monoidratado|di-?hidratada|di-?hidratado|tri-?hidratada|hidratada|hidratado|hemi-?hidratada|anidra|anidro|monossódica|dissódica|benzatina|trometamol)\b/gi;

function capitalize(word: string): string {
  return word ? word[0]!.toLocaleUpperCase('pt-BR') + word.slice(1) : word;
}

/** "Losartana potássica" → "Losartana"; "Cloridrato de metformina" → "Metformina". */
export function shortIngredient(ingredient: string): string {
  return capitalize(ingredient.trim().replace(SALT_BEFORE, '').replace(SALT_AFTER, '').trim().toLocaleLowerCase('pt-BR'));
}

const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

export function medicationBox(name: string, activeIngredient: string | null, hasGeneric: boolean): MedicationBox {
  const ingredient = activeIngredient?.trim() || null;
  const parts = (ingredient ?? name).split('+').map((part) => part.trim()).filter(Boolean);
  const short = parts.map(shortIngredient);
  // Saved by the substance name (or the substance without its salt): a generic.
  const bySubstance =
    !ingredient || fold(name) === fold(ingredient) || fold(name) === fold(short.join(' ')) || fold(name) === fold(short.join(' + '));
  return {
    title: bySubstance ? short.join(' ') : name.trim(),
    substance: ingredient ? parts.map((part) => part.toLocaleLowerCase('pt-BR')).join(' + ') : null,
    generic: bySubstance && hasGeneric,
  };
}
