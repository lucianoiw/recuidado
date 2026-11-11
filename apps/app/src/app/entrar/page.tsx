import type { Metadata } from "next";
import { Suspense } from "react";
import { SignIn } from "./sign-in";

export const metadata: Metadata = { title: "Entrar | Recuidado" };

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignIn />
    </Suspense>
  );
}
