"use client";

import { usePathname } from "next/navigation";
import { BottomNav, HomeIcon, PillIcon, PinIcon, UsersIcon } from "@/components/ui";

export function FamilyNav() {
  // The prescription flow is full screen, like the onboarding.
  const path = usePathname();
  if (path.startsWith("/family/receita") || path.startsWith("/family/adicionar")) return null;
  return (
    <BottomNav
      items={[
        { href: "/family", label: "Hoje", icon: <HomeIcon size={22} /> },
        { href: "/family/remedios", label: "Remédios", icon: <PillIcon size={22} /> },
        { href: "/family/onde-pegar", label: "Onde pegar", icon: <PinIcon size={22} /> },
        { href: "/family/familia", label: "Família", icon: <UsersIcon size={22} /> },
      ]}
    />
  );
}
