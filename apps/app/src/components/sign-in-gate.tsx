"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { readPatientLink, readSession, useHasPatientLink, useSignedIn } from "@/lib/session";

/**
 * Visitors without a login see no family (not even the demo one): the family screens
 * send them to sign in, her screens to the welcome page.
 */
export function SignInGate({ audience, children }: { audience: "family" | "patient"; children: ReactNode }) {
  const router = useRouter();
  const signedIn = useSignedIn();
  const hasLink = useHasPatientLink();
  const allowed = audience === "family" ? signedIn : hasLink;

  useEffect(() => {
    // Reads the storage itself: during hydration `allowed` is still the server's false.
    const ok = audience === "family" ? readSession() !== null : readPatientLink() !== null;
    if (!ok) router.replace(audience === "family" ? "/entrar" : "/");
  }, [allowed, audience, router]);

  return allowed ? children : null;
}
