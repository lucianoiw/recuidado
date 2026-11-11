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
    <section className="flex flex-col gap-2 rounded-card border border-line-soft bg-brand-soft p-4 text-[15px] leading-snug">
      <div className="flex items-start gap-2.5">
        <InfoIcon size={22} className="mt-0.5 shrink-0 text-brand" />
        <span>
          Você está vendo a família de demonstração. Ela não muda. Para testar com a sua família, entre
          com o seu e-mail: os dados ficam separados.
        </span>
      </div>
      <Link href="/entrar" className="font-bold text-brand">
        Entrar ou criar conta
      </Link>
    </section>
  );
}

/** Same banner, loading the family itself (for pages that do not load it). */
export function DemoBannerAuto() {
  const { data } = useFamily();
  return <DemoBanner isDemo={data?.isDemo} />;
}
