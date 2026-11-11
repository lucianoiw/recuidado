import type { ReactNode } from "react";
import { FamilyNav } from "./family-nav";

export default function FamilyLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <FamilyNav />
    </>
  );
}
