"use client";

import { useSyncExternalStore } from "react";
import type { Medication } from "./api";

const KEY = "recuidado:buy-choice";
const listeners = new Set<() => void>();

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Medications the family chose to buy even though they are free.
 * Kept only in this browser until the API stores it.
 */
export function useBuyChoice() {
  const raw = useSyncExternalStore(subscribe, read, () => "[]");
  const chosen = new Set<string>(JSON.parse(raw) as string[]);

  const setBuy = (id: string, buy: boolean) => {
    const next = new Set(chosen);
    if (buy) next.add(id);
    else next.delete(id);
    try {
      localStorage.setItem(KEY, JSON.stringify([...next]));
    } catch {}
    listeners.forEach((l) => l());
  };

  /** True when the family will get this medication for free. */
  const getsFree = (m: Medication) => m.freeInFarmaciaPopular && !chosen.has(m.id);

  return { getsFree, setBuy };
}
