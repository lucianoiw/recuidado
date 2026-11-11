import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInLink } from "./sign-in-link";

export const metadata: Metadata = { title: "Entrar | Recuidado" };

/** The button in the sign-in or invite e-mail lands here. */
export default function SignInLinkPage() {
  return (
    <Suspense fallback={null}>
      <SignInLink />
    </Suspense>
  );
}
