"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { readSession } from "@/lib/session";

/** Someone already signed in skips the welcome and goes to the family. */
export function SignedInRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (readSession()) router.replace("/family");
  }, [router]);
  return null;
}
