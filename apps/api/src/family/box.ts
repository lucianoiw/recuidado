/**
 * Text for the drawn medicine box on the family screens, from the saved medication.
 * A generic box is named by the full substance ("Losartana Potássica"); a brand keeps its
 * own name with the active ingredient below.
 */
export interface MedicationBox {
  /** Big name on the box: "Losartana Potássica" for a generic, "Entresto" for a brand. */
  title: string;
  /** Active ingredient under a brand name: "Sacubitril + Valsartana Sódica". Null on a generic. */
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

const SMALL_WORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

/** "losartana potássica" → "Losartana Potássica"; "cloridrato de metformina" → "Cloridrato de Metformina". */
export function titleCase(text: string): string {
  return text
    .trim()
    .toLocaleLowerCase('pt-BR')
    .split(/\s+/)
    .map((word, i) => (i > 0 && SMALL_WORDS.has(word) ? word : capitalize(word)))
    .join(' ');
}

export function medicationBox(name: string, activeIngredient: string | null, hasGeneric: boolean): MedicationBox {
  const ingredient = activeIngredient?.trim() || null;
  const parts = (ingredient ?? name).split('+').map((part) => part.trim()).filter(Boolean);
  const short = parts.map(shortIngredient);
  const full = parts.map(titleCase).join(' + ');
  // Saved by the substance name (or the substance without its salt).
  const bySubstance =
    !ingredient || fold(name) === fold(ingredient) || fold(name) === fold(short.join(' ')) || fold(name) === fold(short.join(' + '));
  // A generic box carries the full substance as its name (as the law requires), nothing under it.
  if (bySubstance && hasGeneric) return { title: full, substance: null, generic: true };
  return {
    title: titleCase(name),
    substance: ingredient ? full : null,
    generic: false,
  };
}
