import type { Metadata } from "next";
import { Suspense } from "react";
import { OnboardingFlow } from "./onboarding-flow";

export const metadata: Metadata = { title: "Começar | Recuidado" };

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingFlow />
    </Suspense>
  );
}
