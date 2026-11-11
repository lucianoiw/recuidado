"use client";

import { useSyncExternalStore } from "react";

const KEY = "recuidado:caregiver";
const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Saves which caregiver is using this device. */
export function setMe(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {}
  listeners.forEach((l) => l());
}

/** Forgets the caregiver on this device. */
export function clearMe(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {}
  listeners.forEach((l) => l());
}

/** The caregiver id this device keeps, read once outside React. */
export function readMe(): string | null {
  return read();
}

/** Which caregiver is using this device. Only the id is kept in this browser. */
export function useMe(): [string | null, (id: string) => void] {
  const me = useSyncExternalStore(subscribe, read, () => null);
  return [me, setMe];
}
