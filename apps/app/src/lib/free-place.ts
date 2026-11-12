import type { Medication } from "./api";

/**
 * Where each medication is free, so nobody goes to the UBS for a medicine that only the
 * Farmácia Popular gives (or the other way around).
 */
export type FreeWhere = "ubs" | "fp" | "both" | "high_cost" | null;

export function freeWhere(m: Medication): FreeWhere {
  const fp = m.freeInFarmaciaPopular || (m.freeAt?.includes("farmacia_popular") ?? false);
  const ubs = m.freeAt?.includes("ubs") ?? false;
  if (fp && ubs) return "both";
  if (ubs) return "ubs";
  if (fp) return "fp";
  if (m.highCost) return "high_cost";
  return null;
}

/** Goes to the UBS: only there, or in both places. */
export function atUbs(m: Medication): boolean {
  const w = freeWhere(m);
  return w === "ubs" || w === "both";
}

/** Goes to a Farmácia Popular pharmacy. */
export function atFarmaciaPopular(m: Medication): boolean {
  const w = freeWhere(m);
  return w === "fp" || w === "both";
}

/** One plain sentence on where to get it, e.g. "Só no posto de saúde. Não tem no Farmácia Popular." */
export function freeWhereLine(m: Medication): string | null {
  switch (freeWhere(m)) {
    case "both":
      return "No posto de saúde ou no Farmácia Popular.";
    case "ubs":
      return "Só no posto de saúde. Não tem no Farmácia Popular.";
    case "fp":
      return "Só no Farmácia Popular, em drogaria credenciada. Não tem no posto.";
    case "high_cost":
      return "Só na Farmácia de Alto Custo, com laudo do médico (LME).";
    default:
      return null;
  }
}
