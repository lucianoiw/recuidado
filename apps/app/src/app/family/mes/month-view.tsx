"use client";

import Link from "next/link";
import { CartIcon, ChevronLeftIcon, ChevronRightIcon, FreeIcon, InfoIcon, PillIcon } from "@/components/ui";
import { PageTitle } from "@/components/page-title";
import { useMonth } from "@/lib/use-month";
import { brl, medLabel } from "@/lib/use-family";

function placeText(freeAt: string[]): string {
  const fp = freeAt.includes("farmacia_popular");
  const ubs = freeAt.includes("ubs");
  if (fp && ubs) return "Farmácia Popular ou posto";
  if (fp) return "Farmácia Popular";
  if (ubs) return "Posto de saúde";
  return "Grátis";
}

function dateText(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function MonthView() {
  const { data, error } = useMonth();

  if (error) return <p className="text-muted">Sem conexão com o servidor.</p>;
  if (!data) return <p className="text-muted">Carregando...</p>;

  const { doses } = data;
  const counted = doses.taken + doses.missed + doses.pending;
  const percent = counted > 0 ? Math.round((doses.taken / counted) * 100) : null;
  const paid = data.split.shares.filter((s) => s.paid).length;

  return (
    <>
      <Link
        href="/family"
        className="flex size-11 items-center justify-center rounded-full border border-line-soft bg-surface"
      >
        <ChevronLeftIcon size={22} />
        <span className="sr-only">Voltar</span>
      </Link>
      <PageTitle title="Resumo do mês" subtitle={data.label.charAt(0).toUpperCase() + data.label.slice(1)} />

      <section className="flex flex-col gap-1 rounded-card bg-brand p-5 text-white">
        <span className="text-[16px] font-bold opacity-90">A família economizou</span>
        <span className="text-[40px] font-extrabold leading-tight">{brl.format(data.savedCents / 100)}</span>
        <span className="text-[15px] opacity-90">
          {data.saved.length === 0
            ? "Nenhum remédio sai grátis ainda."
            : `${data.saved.length} ${data.saved.length === 1 ? "remédio sai" : "remédios saem"} grátis este mês`}
        </span>
      </section>

      {data.saved.length > 0 ? (
        <ul className="overflow-hidden rounded-card border border-line-soft bg-surface">
          {data.saved.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3 last:border-b-0">
              <span className="flex min-w-0 flex-col">
                <span className="font-bold">{medLabel(m.name, m.strength)}</span>
                <span className="flex items-center gap-1 text-[14px] text-brand">
                  <FreeIcon size={16} />
                  {placeText(m.freeAt)}
                </span>
              </span>
              <span className="whitespace-nowrap font-bold">
                {m.monthlyCents > 0 ? brl.format(m.monthlyCents / 100) : "Sem preço"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {data.highCostPotentialCents > 0 ? (
        <section className="rounded-card border border-line-soft bg-warn-soft p-4 text-warn">
          <b>Pode economizar mais {brl.format(data.highCostPotentialCents / 100)} por mês</b>
          <p className="text-[15px]">Com laudo do médico, pelo Alto Custo do estado.</p>
        </section>
      ) : null}

      <Link
        href="/family/comprar"
        className="flex items-center gap-3 rounded-card border border-line-soft bg-surface p-4 no-underline"
      >
        <span className="flex size-11 items-center justify-center rounded-[14px] bg-warn-soft text-warn">
          <CartIcon size={24} />
        </span>
        <span className="flex flex-1 flex-col">
          <b>Gasto do mês: até {brl.format(data.costCents / 100)}</b>
          <span className="text-[15px] text-muted">
            {data.toBuy.length === 0
              ? "Nada para comprar"
              : data.split.mode === "rotation"
                ? data.split.rotation?.payer
                  ? `Este mês ${data.split.rotation.payer.name} compra${data.split.shares[0]?.paid ? " (já comprou)" : ""}`
                  : "Cada mês um compra"
                : data.split.receiver
                ? `${paid} de ${data.split.shares.length} já pagaram. Dividir com Pix`
                : "Dividir entre a família com Pix"}
          </span>
        </span>
        <ChevronRightIcon size={20} className="text-muted" />
      </Link>

      <section className="flex items-center gap-3 rounded-card border border-line-soft bg-surface p-4">
        <span className="flex size-11 items-center justify-center rounded-[14px] bg-brand-soft text-brand">
          <PillIcon size={24} />
        </span>
        <span className="flex flex-1 flex-col">
          <b>
            {counted === 0
              ? "Nenhuma dose ainda este mês"
              : `${doses.taken} de ${counted} doses tomadas${percent !== null ? ` (${percent}%)` : ""}`}
          </b>
          {counted > 0 ? (
            <span className="text-[15px] text-muted">
              {doses.byVoice > 0 ? `${doses.byVoice} confirmadas por ligação. ` : ""}
              {doses.missed > 0 ? `${doses.missed} sem tomar.` : "Nenhuma esquecida."}
            </span>
          ) : null}
        </span>
      </section>

      <p className="flex items-start gap-2 text-[15px] leading-snug text-muted">
        <InfoIcon size={18} className="mt-0.5 shrink-0" />
        Valores pelo preço máximo ao consumidor (PMC) da CMED em São Paulo, da caixa mais barata, para 30 dias
        {data.priceListDate ? `. Lista de ${dateText(data.priceListDate)}` : ""}. Na farmácia pode sair mais barato.
      </p>
    </>
  );
}
