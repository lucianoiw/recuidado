"use client";

import { usePronouns } from "@/lib/pronouns";

/** "ela"/"ele", "Ela"/"Ele", "dela"/"dele" or "a"/"o" for the patient, inside server-rendered text. */
export function PatientWord({ w }: { w: "ela" | "Ela" | "dela" | "a" }) {
  return usePronouns()[w];
}
