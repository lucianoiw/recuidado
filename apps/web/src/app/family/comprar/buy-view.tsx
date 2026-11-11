"use client";

import Link from "next/link";
import { CartIcon, ChevronLeftIcon, InfoIcon, StatusPill } from "@/components/ui";
import { PageTitle } from "@/components/page-title";
import { isFree } from "@/lib/api";
import { useBuyChoice } from "@/lib/buy-choice";
import { useMe } from "@/lib/me";
import { brl, medLabel, useFamily } from "@/lib/use-family";

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase();
}

export function BuyView() {
  const { data, error } = useFamily();
  const [me] = useMe();
  const { getsFree } = useBuyChoice();

  if (error) return <p className="text-muted">Sem conexão com o servidor.</p>;
  if (!data) return <p className="text-muted">Carregando...</p>;

  const paid = data.medications.filter((m) => !getsFree(m));
  const totalCents = paid.reduce((sum, m) => sum + m.monthlyCostCents, 0);
  const people = data.caregivers.length;
  const shareCents = people > 0 ? Math.ceil(totalCents / people) : 0;

  return (
    <>
      <Link
        href="/family/remedios"
        className="flex size-11 items-center justify-center rounded-full border border-line-soft bg-surface"
      >
        <ChevronLeftIcon size={22} />
        <span className="sr-only">Voltar</span>
      </Link>
      <PageTitle title="Comprar à parte" subtitle="O que a família vai comprar todo mês" />

      {paid.length === 0 ? (
        <section className="flex flex-col items-center gap-2 rounded-card border border-line-soft bg-surface p-6 text-center">
          <span className="flex size-14 items-center justify-center rounded-[18px] bg-brand-soft text-brand">
            <CartIcon size={28} />
          </span>
          <b className="text-[19px]">Nada para comprar</b>
          <p className="text-muted">Todos os remédios da receita saem grátis.</p>
        </section>
      ) : (
        <>
          <ul className="overflow-hidden rounded-card border border-line-soft bg-surface">
            {paid.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3.5 last:border-b-0"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="font-bold">{medLabel(m.name, m.strength)}</span>
                  <span className="text-[15px] text-muted">
                    {m.times.length} {m.times.length === 1 ? "vez" : "vezes"} ao dia
                    {isFree(m) ? ". Vocês escolheram comprar" : ""}
                  </span>
                </div>
                <span className="whitespace-nowrap font-bold">
                  {m.monthlyCostCents > 0 ? brl.format(m.monthlyCostCents / 100) : "Sem preço"}
                </span>
              </li>
            ))}
          </ul>

          {totalCents > 0 && people > 0 ? (
            <section className="flex flex-col gap-3 rounded-card border border-line-soft bg-surface p-4">
              <div className="flex items-baseline justify-between">
                <h2 className="text-[18px] font-extrabold">Dividir entre a família</h2>
                <span className="text-[18px] font-extrabold">{brl.format(totalCents / 100)}</span>
              </div>
              <ul className="flex flex-col gap-2.5">
                {data.caregivers.map((c) => (
                  <li key={c.id} className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[15px] font-extrabold text-brand"
                    >
                      {initial(c.name)}
                    </span>
                    <span className="flex-1">
                      {c.name}
                      {c.id === me ? " (você)" : ""}
                    </span>
                    <b>{brl.format(shareCents / 100)}</b>
                  </li>
                ))}
              </ul>
              <StatusPill tone="neutral" className="w-fit">
                Por mês, em partes iguais
              </StatusPill>
            </section>
          ) : null}

          <p className="flex items-start gap-2 text-[15px] leading-snug text-muted">
            <InfoIcon size={18} className="mt-0.5 shrink-0" />
            Preços de referência por mês. Na demonstração não há compra de verdade.
          </p>
        </>
      )}
    </>
  );
}
