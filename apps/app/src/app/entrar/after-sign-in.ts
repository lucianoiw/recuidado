"use client";

import { claimInvite, type Me } from "@/lib/api";

/**
 * Where to go after signing in. An invite shared by WhatsApp (?convite=<family>&nome=<name>) is
 * taken first; someone without a family yet goes to the sign-up.
 */
export async function afterSignIn(me: Me, params: URLSearchParams): Promise<string> {
  const family = params.get("convite");
  const name = params.get("nome");
  if (!me.memberId && family && name) {
    const joined = await claimInvite(family, name);
    if (joined.familyId) return "/family";
  }
  const next = params.get("next");
  if (me.familyId) return next?.startsWith("/") && !next.startsWith("//") ? next : "/family";
  return "/comecar";
}
