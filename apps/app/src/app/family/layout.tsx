import { Suspense, type ReactNode } from "react";
import { SignInGate } from "@/components/sign-in-gate";
import { FamilyNav } from "./family-nav";

export default function FamilyLayout({ children }: { children: ReactNode }) {
  return (
    <SignInGate audience="family">
      {children}
      {/* Dynamic routes (/family/alto-custo/[id]) only know the path at request time. */}
      <Suspense fallback={null}>
        <FamilyNav />
      </Suspense>
    </SignInGate>
  );
}
