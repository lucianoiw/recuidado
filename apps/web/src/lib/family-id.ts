"use client";

// Which family this device follows. Set at sign-up or by an invite link (?f=<id>).
// Without one the screens show the demo family (Dona Maria), which nobody can change.
const KEY = "recuidado:family";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The family id of this device. An invite link's ?f= wins and is kept. */
export function readFamilyId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const fromLink = new URLSearchParams(window.location.search).get("f");
    if (fromLink && UUID.test(fromLink)) {
      localStorage.setItem(KEY, fromLink);
      return fromLink;
    }
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Forgets the family on this device (after the family deleted its data). */
export function clearFamilyId(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export function setFamilyId(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {}
}

/** Adds ?familyId= to an API path when this device has a family. */
export function withFamily(path: string): string {
  const id = readFamilyId();
  if (!id) return path;
  return `${path}${path.includes("?") ? "&" : "?"}familyId=${id}`;
}

/** A link to share (invite, patient app) that opens this device's family on the other phone. */
export function familyLink(origin: string, path: string): string {
  const id = readFamilyId();
  return id ? `${origin}${path}?f=${id}` : `${origin}${path}`;
}
