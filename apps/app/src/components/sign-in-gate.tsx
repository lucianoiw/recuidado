"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { getMe } from "@/lib/api";
import { readPatientLink, readSession, useHasPatientLink, useSignedIn } from "@/lib/session";

/**
 * Visitors without a login see no family (not even the demo one): the family screens
 * send them to sign in, her screens to the welcome page. A caregiver session is checked
 * once with the API: an expired one (or one whose family was deleted) goes to sign in,
 * and one without a family yet goes to the sign-up.
 */
export function SignInGate({ audience, children }: { audience: "family" | "patient"; children: ReactNode }) {
  const router = useRouter();
  const signedIn = useSignedIn();
  const hasLink = useHasPatientLink();
  const [checked, setChecked] = useState(audience === "patient");
  const allowed = (audience === "family" ? signedIn : hasLink) && checked;

  useEffect(() => {
    // Reads the storage itself: during hydration the hooks above still give the server's false.
    const ok = audience === "family" ? readSession() !== null : readPatientLink() !== null;
    if (!ok) router.replace(audience === "family" ? "/entrar" : "/");
  }, [signedIn, hasLink, audience, router]);

  useEffect(() => {
    if (audience !== "family" || !readSession()) return;
    getMe().then(
      (me) => {
        // getMe forgets an expired session, and the effect above then goes to sign in.
        if (me && !me.familyId) router.replace("/comecar");
        else if (me) setChecked(true);
      },
      // API unreachable: let the screens show their own error.
      () => setChecked(true),
    );
  }, [audience, router]);

  return allowed ? children : null;
}
