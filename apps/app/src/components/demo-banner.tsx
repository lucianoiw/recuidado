"use client";

import Link from "next/link";
import { InfoIcon } from "@/components/ui";
import { useFamily } from "@/lib/use-family";

/**
 * Shown while nobody is signed in on this device: the screens show the demo family,
 * which nobody can change. Signing up creates a separate family.
 */
export function DemoBanner({ isDemo }: { isDemo?: boolean }) {
  if (!isDemo) return null;
  return (
    <section className="flex items-center gap-3 rounded-card bg-ink p-3 pl-4 text-[14px] leading-snug text-white">
      <InfoIcon size={20} className="shrink-0 text-white/80" />
      <span className="flex-1">Família de demonstração, com dados fictícios. Para usar com a sua, entre com o seu e-mail.</span>
      <Link href="/entrar" className="shrink-0 rounded-full bg-surface px-3.5 py-2 text-[14px] font-semibold text-ink no-underline">
        Entrar
      </Link>
    </section>
  );
}

/** Same banner, loading the family itself (for pages that do not load it). */
export function DemoBannerAuto() {
  const { data } = useFamily();
  return <DemoBanner isDemo={data?.isDemo} />;
}
