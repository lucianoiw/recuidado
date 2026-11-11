import type { Metadata } from "next";
import { OnboardingFlow } from "./onboarding-flow";

export const metadata: Metadata = { title: "Começar | Recuidado" };

export default function OnboardingPage() {
  return <OnboardingFlow />;
}
