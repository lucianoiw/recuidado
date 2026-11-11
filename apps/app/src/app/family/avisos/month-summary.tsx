"use client";

import { useEffect, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, ShareIcon, cn } from "@/components/ui";
import { track } from "@/lib/analytics";
import { getFamily, type FamilyOverview } from "@/lib/api";

// Illustrative month numbers for the hackathon demo. Synthetic, not computed from the doses yet.
const MONTHS = ["Jun", "Jul", "Ago", "Set", "Out", "Nov"];
const ADHERENCE = [88, 90, 91, 93, 96, 94];
const PREVIOUS = [
  { month: "Outubro", pct: 96, saved: "R$ 120" },
  { month: "Setembro", pct: 93, saved: "R$ 110" },
  { month: "Agosto", pct: 91, saved: "R$ 95" },
];
const PER_MED = [
  { pct: 98, note: "Esqueceu 1 vez, tomou depois da ligação" },
  { pct: 92, note: "A dose do meio-dia é a mais esquecida" },
  { pct: 93, note: "Sem falhas na última semana" },
];

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", day: "numeric", month: "numeric", year: "numeric" });

function today(now: Date): { day: number; month: number; year: number; name: string } {
  const [y, m, d] = dayFmt.format(now).split("-").map(Number);
  const name = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "America/Sao_Paulo" }).format(now);
  return { day: d, month: m, year: y, name };
}

type DayState = "ok" | "late" | "missed" | "future";

const DAY_TONE: Record<DayState, string> = {
  ok: "bg-brand text-white",
  late: "bg-[#E8A33D] text-white",
  missed: "bg-danger text-white",
  future: "border border-dashed border-line text-muted",
};

function Stat({ label, value, sub, brand }: { label: string; value: string; sub: string; brand?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-card border border-line-soft bg-surface px-4 py-3.5">
      <span className="text-[14px] text-muted">{label}</span>
      <span className={cn("text-[26px] font-extrabold", brand && "text-brand")}>{value}</span>
      <span className="text-[13px] text-muted">{sub}</span>
    </div>
  );
}

/** Month at a glance on top of the alerts: numbers, calendar, last months, per medicine. */
export function MonthSummary() {
  const [data, setData] = useState<FamilyOverview | null>(null);
  const [t, setT] = useState<ReturnType<typeof today> | null>(null);
  useEffect(() => {
    getFamily()
      .then(setData, () => setData(null))
      .finally(() => setT(today(new Date())));
  }, []);

  if (!t) return null;
  const monthName = t.name.charAt(0).toUpperCase() + t.name.slice(1);
  const firstWeekday = new Date(Date.UTC(t.year, t.month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(t.year, t.month, 0)).getUTCDate();
  const missedToday = data?.today.some((d) => d.status === "missed") ?? false;
  const state = (d: number): DayState =>
    d > t.day ? "future" : d === t.day ? (missedToday ? "missed" : "ok") : d % 7 === 3 ? "late" : "ok";
  const meds = (data?.medications ?? []).filter((m) => m.times.length > 0).slice(0, 3);

  return (
    <>
      <div className="flex items-center justify-between rounded-card border border-line-soft bg-surface p-1.5">
        <span className="flex size-11 items-center justify-center text-muted" aria-hidden="true">
          <ChevronLeftIcon size={20} />
        </span>
        <span className="flex flex-col items-center">
          <b className="text-[17px]">
            {monthName} de {t.year}
          </b>
          <span className="text-[13px] text-muted">até hoje, dia {t.day}</span>
        </span>
        <span className="flex size-11 items-center justify-center text-muted opacity-30" aria-hidden="true">
          <ChevronRightIcon size={20} />
        </span>
      </div>

      <section className="grid grid-cols-2 gap-3">
        <Stat label="Doses tomadas" value="94%" sub="48 de 51 confirmadas" />
        <Stat label="Economia" value="R$ 120" sub="com o que saiu grátis" brand />
        <Stat label="Ligações da IA" value="6" sub="5 atendidas" />
        <Stat label="Avisos para vocês" value="3" sub="1 de cada tipo" />
      </section>

      <section className="flex flex-col gap-3 rounded-card border border-line-soft bg-surface px-4 py-3.5">
        <h2 className="text-[17px] font-extrabold">Dia a dia</h2>
        <div className="grid grid-cols-7 gap-1.5 text-center text-[13px] font-bold">
          {["D", "S", "T", "Q", "Q", "S", "S"].map((w, i) => (
            <span key={i} className="text-[12px] text-muted">
              {w}
            </span>
          ))}
          {Array.from({ length: firstWeekday }, (_, i) => (
            <span key={`e${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
            <span key={d} className={cn("flex h-[30px] items-center justify-center rounded-lg", DAY_TONE[state(d)])}>
              {d}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[13px] text-muted">
          <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-[3px] bg-brand" />Tomou tudo</span>
          <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-[3px] bg-[#E8A33D]" />Tomou depois da ligação</span>
          <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-[3px] bg-danger" />Ficou sem confirmar</span>
        </div>
      </section>

      <section className="flex flex-col gap-2.5 rounded-card border border-line-soft bg-surface px-4 py-3.5">
        <h2 className="text-[17px] font-extrabold">Doses tomadas, últimos 6 meses</h2>
        <div className="flex gap-2">
          {MONTHS.map((m, i) => {
            const last = i === MONTHS.length - 1;
            return (
              <div key={m} className="flex flex-1 flex-col items-center gap-1.5">
                <span className={cn("text-[13px] font-bold", last ? "text-brand" : "text-muted")}>{ADHERENCE[i]}%</span>
                <div className="flex h-[90px] w-full items-end">
                  <div
                    className={cn("w-full rounded-t-lg rounded-b", last ? "bg-brand" : "bg-brand-soft")}
                    style={{ height: `${((ADHERENCE[i] - 70) * 90) / 30}px` }}
                  />
                </div>
                <span className={cn("text-[13px]", last ? "font-extrabold" : "text-muted")}>{m}</span>
              </div>
            );
          })}
        </div>
      </section>

      {meds.length > 0 ? (
        <section className="overflow-hidden rounded-card border border-line-soft bg-surface">
          <h2 className="px-4 pb-2.5 pt-3.5 text-[17px] font-extrabold">Por remédio</h2>
          {meds.map((m, i) => (
            <div key={m.id} className="flex flex-col gap-1.5 border-t border-line-soft px-4 py-2.5">
              <div className="flex justify-between text-[15px]">
                <b>{[m.name, m.strength].filter(Boolean).join(" ")}</b>
                <span className="font-bold">{PER_MED[i].pct}%</span>
              </div>
              <div className="h-2 rounded bg-line-soft">
                <div className="h-2 rounded bg-brand" style={{ width: `${PER_MED[i].pct}%` }} />
              </div>
              <span className="text-[13px] text-muted">{PER_MED[i].note}</span>
            </div>
          ))}
        </section>
      ) : null}

      <section className="overflow-hidden rounded-card border border-line-soft bg-surface">
        <h2 className="px-4 pb-2.5 pt-3.5 text-[17px] font-extrabold">Meses anteriores</h2>
        {PREVIOUS.map((p) => (
          <div key={p.month} className="flex items-center gap-3 border-t border-line-soft px-4 py-3">
            <span className="flex flex-1 flex-col">
              <b>
                {p.month} de {t.year}
              </b>
              <span className="text-[14px] text-muted">
                {p.pct}% das doses, economia de {p.saved}
              </span>
            </span>
            <ChevronRightIcon size={20} />
          </div>
        ))}
      </section>

      <button
        type="button"
        onClick={() => {
          track("history_pdf_tapped");
          window.print();
        }}
        className="flex h-[52px] items-center justify-center gap-2 rounded-2xl border-[1.5px] border-ink font-extrabold"
      >
        <ShareIcon size={20} />
        Levar o resumo para a consulta
      </button>
      <p className="-mt-2 text-center text-[13px] text-muted">Um PDF com as doses do mês. O app não avalia a saúde dela.</p>
    </>
  );
}
