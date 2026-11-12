/**
 * Where a medicine is free, from the program files shipped in seed/programs/.
 * The API answers from the database copy of the same programs (refreshed every month);
 * this is the version without a database, used by search and tests.
 */
import { seedProgramIndex, type FreeAccess, type Patient } from "./programs.ts";

export { isExtendedRelease, type FreeAccess, type FreePlace } from "./programs.ts";

/**
 * Looks up a medicine by its active ingredient(s) and strength as written,
 * e.g. ("Losartana Potássica", "50 mg") or ("levodopa + benserazida", "200 mg + 50 mg").
 * `name` is the name on the prescription ("Metformina XR"): an extended-release product is
 * only free where that list has the extended-release item.
 */
export function findFreeAccess(
  activeIngredient: string,
  strength: string | null | undefined,
  name?: string | null,
  patient?: Patient,
): FreeAccess {
  return seedProgramIndex().find(activeIngredient, strength, name, patient);
}
