"use client";

import Link from "next/link";
import { CartIcon, ChevronLeftIcon, InfoIcon, NavigationIcon } from "@/components/ui";
import { SplitPix } from "@/components/split-pix";
import { PageTitle } from "@/components/page-title";
import { isFree } from "@/lib/api";
import { formatDistance, mapsUrl, pharmacies } from "@/lib/pharmacies";
import { useBuyChoice } from "@/lib/buy-choice";
import { useMonth } from "@/lib/use-month";
import { brl, medLabel, useFamily } from "@/lib/use-family";

export function BuyView() {
  const { data, error } = useFamily();
  const { getsFree } = useBuyChoice();
  const { data: month, reload: reloadMonth } = useMonth();

  if (error) return <p className="text-muted">Sem conexão com o servidor.</p>;
  if (!data) return <p className="text-muted">Carregando...</p>;

  const paid = data.medications.filter((m) => !getsFree(m));

  return (
    <>
      <Link
        href="/family/remedios"
        className="flex size-11 items-center justify-center rounded-full border border-line-soft bg-surface"
      >
        <ChevronLeftIcon size={22} />
        <span className="sr-only">Voltar</span>
      </Link>
      <PageTitle title="Onde comprar e dividir" subtitle="O que não sai grátis e a família compra todo mês" />

      {paid.length === 0 ? (
        <section className="flex flex-col items-center gap-2 rounded-card border border-line-soft bg-surface p-6 text-center">
          <span className="flex size-14 items-center justify-center rounded-[18px] bg-brand-soft text-brand">
            <CartIcon size={28} />
          </span>
          <b className="text-[19px]">Nada para comprar</b>
          <p className="text-muted">Todos os remédios da receita podem sair grátis.</p>
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
                    {m.price?.unitsPerPack ? `. Caixa com ${m.price.unitsPerPack}: até ${brl.format(m.price.packCents / 100)}` : ""}
                  </span>
                </div>
                <span className="whitespace-nowrap font-bold">
                  {m.monthlyCostCents > 0 ? brl.format(m.monthlyCostCents / 100) : "Sem preço"}
                </span>
              </li>
            ))}
          </ul>

          {month && month.costCents > 0 && month.split.shares.length > 0 ? (
            <SplitPix month={month} isDemo={data.isDemo ?? false} onChanged={reloadMonth} />
          ) : null}

          <section className="flex flex-col gap-2">
            <h2 className="text-[18px] font-extrabold">Farmácias perto dela</h2>
            <ul className="overflow-hidden rounded-card border border-line-soft bg-surface">
              {pharmacies.slice(0, 3).map((p) => (
                <li key={p.cnes} className="flex flex-col gap-2 border-b border-line-soft px-4 py-3.5 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <b className="leading-snug">{p.name}</b>
                    <span className="whitespace-nowrap text-[15px] font-bold text-muted">
                      {formatDistance(p.distanceKm)}
                    </span>
                  </div>
                  <span className="text-[15px] leading-snug text-muted">{p.address}</span>
                  <a
                    href={mapsUrl(p)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl border-[1.5px] border-ink px-3.5 text-[15px] font-bold text-ink no-underline"
                  >
                    <NavigationIcon size={18} />
                    Como chegar
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <p className="flex items-start gap-2 text-[15px] leading-snug text-muted">
            <InfoIcon size={18} className="mt-0.5 shrink-0" />
            Preço máximo ao consumidor (PMC) da CMED em São Paulo, da caixa mais barata, para 30 dias. Na farmácia pode sair mais barato. Na demonstração não há compra de verdade.
          </p>
        </>
      )}
    </>
  );
}
