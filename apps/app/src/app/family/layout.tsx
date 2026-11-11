import { Suspense, type ReactNode } from "react";
import { FamilyNav } from "./family-nav";

export default function FamilyLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      {/* Dynamic routes (/family/alto-custo/[id]) only know the path at request time. */}
      <Suspense fallback={null}>
        <FamilyNav />
      </Suspense>
    </>
  );
}
