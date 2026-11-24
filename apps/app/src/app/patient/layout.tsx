import type { ReactNode } from "react";
import { SignInGate } from "@/components/sign-in-gate";

export default function PatientLayout({ children }: { children: ReactNode }) {
  return <SignInGate audience="patient">{children}</SignInGate>;
}
