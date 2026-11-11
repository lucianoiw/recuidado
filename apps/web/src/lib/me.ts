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

/** Which caregiver is using this device. Kept only in this browser. */
export function useMe(): [string | null, (id: string) => void] {
  const me = useSyncExternalStore(subscribe, read, () => null);
  const setMe = (id: string) => {
    try {
      localStorage.setItem(KEY, id);
    } catch {}
    listeners.forEach((l) => l());
  };
  return [me, setMe];
}
