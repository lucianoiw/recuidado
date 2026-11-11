"use client";

import { useSyncExternalStore } from "react";
import { isFree, setBuyChoice, type Medication } from "./api";

// Choices made on this page, shown right away while GET /family catches up.
let pending: Record<string, boolean> = {};
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function update(next: Record<string, boolean>) {
  pending = next;
  listeners.forEach((l) => l());
}

/** "Pegar grátis" or "Comprar" for medications free in Farmácia Popular, saved in the API. */
export function useBuyChoice() {
  const choices = useSyncExternalStore(subscribe, () => pending, () => pending);

  const setBuy = (id: string, buy: boolean) => {
    const before = choices[id];
    update({ ...pending, [id]: buy });
    setBuyChoice(id, buy).catch(() => {
      const rest = { ...pending };
      if (before === undefined) delete rest[id];
      else rest[id] = before;
      update(rest);
    });
  };

  /** True when the family will get this medication for free. */
  const getsFree = (m: Medication) =>
    isFree(m) && !(choices[m.id] ?? m.buyInsteadOfFree ?? false);

  return { getsFree, setBuy };
}
