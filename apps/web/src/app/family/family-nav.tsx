"use client";

import { usePathname } from "next/navigation";
import { BottomNav, HomeIcon, PillIcon, PinIcon, UsersIcon } from "@/components/ui";

export function FamilyNav() {
  // The prescription flow is full screen, like the onboarding.
  if (usePathname().startsWith("/family/receita")) return null;
  return (
    <BottomNav
      items={[
        { href: "/family", label: "Hoje", icon: <HomeIcon size={26} /> },
        { href: "/family/remedios", label: "Remédios", icon: <PillIcon size={26} /> },
        { href: "/family/onde-pegar", label: "Onde pegar", icon: <PinIcon size={26} /> },
        { href: "/family/familia", label: "Família", icon: <UsersIcon size={26} /> },
      ]}
    />
  );
}
