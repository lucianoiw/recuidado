"use client";

import { useSyncExternalStore } from "react";

// Two separate logins live in this browser:
// - the caregiver's session, from the e-mail sign-in (family screens);
// - the patient link the family sent to her phone (/m/<token>, her screens). She never signs up.
// Each screen sends only its own: /patient/* sends the patient link, everything else the session.
const SESSION = "recuidado:session";
const PATIENT = "recuidado:patient-link";

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {}
  notify();
}

export const readSession = () => read(SESSION);
export const setSession = (token: string | null) => write(SESSION, token);
export const readPatientLink = () => read(PATIENT);
export const setPatientLink = (token: string | null) => write(PATIENT, token);

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True when this browser has a caregiver session. False while rendering on the server. */
export function useSignedIn(): boolean {
  return useSyncExternalStore(subscribe, () => readSession() !== null, () => false);
}

/** True when this browser opened the patient link. */
export function useHasPatientLink(): boolean {
  return useSyncExternalStore(subscribe, () => readPatientLink() !== null, () => false);
}

/** Authorization header for the screen that is calling. Empty for visitors (demo family). */
export function authHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const patient = window.location.pathname.startsWith("/patient");
  const token = patient ? readPatientLink() : readSession();
  if (!token) return {};
  return { authorization: `Bearer ${patient ? `p.${token}` : token}` };
}
