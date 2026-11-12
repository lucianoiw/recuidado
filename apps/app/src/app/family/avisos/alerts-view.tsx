"use client";

import { useEffect, useState } from "react";
import { AlertIcon, BellIcon, CartIcon, HeartIcon, PhoneIcon, PillIcon, Segmented, TopBar, cn } from "@/components/ui";
import { markAlertsSeen } from "@/lib/alerts-seen";
import { captureError } from "@/lib/analytics";
import { MonthSummary } from "./month-summary";
import { formatTime, getAlerts, type AlertKind, type FamilyAlert } from "@/lib/api";

const KINDS: Record<AlertKind, { label: string; icon: typeof AlertIcon; tone: string }> = {
  dose_missed: { label: "Dose não confirmada", icon: AlertIcon, tone: "bg-danger-soft text-danger" },
  unwell: { label: "Disse que não está bem", icon: HeartIcon, tone: "bg-warn-soft text-warn" },
  low_stock: { label: "Remédio acabando", icon: PillIcon, tone: "bg-warn-soft text-warn" },
  emergency: { label: "Emergência", icon: AlertIcon, tone: "bg-danger text-white" },
  emergency_call: { label: "Ligação para a família", icon: PhoneIcon, tone: "bg-danger-soft text-danger" },
  check_in: { label: "Ligação de volta", icon: PhoneIcon, tone: "bg-blush text-accent-ink" },
  rotation_turn: { label: "Vez de comprar", icon: CartIcon, tone: "bg-blush text-accent-ink" },
};

/** How the alert reached the family. */
function channel(a: FamilyAlert): string {
  if (a.kind === "emergency_call") return "Por ligação de voz";
  const parts: string[] = [];
  if (a.pushesDelivered > 0) parts.push(`notificação em ${a.pushesDelivered} ${a.pushesDelivered === 1 ? "celular" : "celulares"}`);
  if (a.emailsDelivered > 0) parts.push(`e-mail para ${a.emailsDelivered} ${a.emailsDelivered === 1 ? "pessoa" : "pessoas"}`);
  if (parts.length === 0) return "Só no app: ninguém com notificação ou e-mail";
  const text = parts.join(" e ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

type Tab = "avisos" | "mes";
const TABS = [
  { value: "avisos", label: "Avisos" },
  { value: "mes", label: "Resumo do mês" },
] as const;

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });
const dayLabel = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** "Hoje", "Ontem" or "Segunda, 9 de novembro". */
function dayTitle(iso: string, now: Date): string {
  const key = dayKey.format(new Date(iso));
  if (key === dayKey.format(now)) return "Hoje";
  if (key === dayKey.format(new Date(now.getTime() - 24 * 60 * 60 * 1000))) return "Ontem";
  const t = dayLabel.format(new Date(iso)).replace("-feira", "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Every alert the family got, grouped by day, newest first. */
export function AlertsView() {
  const [alerts, setAlerts] = useState<FamilyAlert[] | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(0);
  const [tab, setTab] = useState<Tab>("avisos");

  useEffect(() => {
    const load = () =>
      getAlerts().then(
        (a) => {
          setAlerts(a);
          setNow(Date.now());
          markAlertsSeen(a);
          setError(false);
        },
        (e) => {
          captureError(e, { view: "alerts" });
          setError(true);
        },
      );
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, []);

  const days: { title: string; items: FamilyAlert[] }[] = [];
  for (const a of alerts ?? []) {
    const title = dayTitle(a.createdAt, new Date(now));
    const last = days.at(-1);
    if (last?.title === title) last.items.push(a);
    else days.push({ title, items: [a] });
  }

  return (
    <>
      <TopBar backHref="/family" />
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-[32px] leading-[1.08]">Avisos</h1>
        <p className="text-[16px] text-muted">Tudo que o Recuidado avisou à família, do mais novo para o mais antigo.</p>
      </header>

      <Segmented label="Ver" options={TABS} value={tab} onChange={setTab} />

      {tab === "mes" ? <MonthSummary /> : null}
      {tab === "avisos" ? (
        <>
          {error && !alerts ? <p className="text-muted">Sem conexão com o servidor.</p> : null}
          {!error && !alerts ? <p className="text-muted">Carregando...</p> : null}

          {alerts && alerts.length === 0 ? (
            <section className="flex flex-col items-center gap-3 rounded-card bg-surface p-6 text-center">
              <span className="flex size-16 items-center justify-center rounded-full bg-blush text-accent-ink">
                <BellIcon size={32} />
              </span>
              <b className="text-[19px]">Nenhum aviso ainda</b>
              <p className="text-muted">
                Quando uma dose não for confirmada, ela disser que não está bem, houver uma emergência ou um
                remédio estiver acabando, o aviso aparece aqui.
              </p>
            </section>
          ) : null}

          {days.map((day) => (
            <section key={day.title} className="flex flex-col gap-2">
              <h2 className="text-[18px] font-semibold">{day.title}</h2>
              <ul className="overflow-hidden rounded-card bg-surface">
                {day.items.map((a) => {
                  const kind = KINDS[a.kind];
                  const Icon = kind.icon;
                  return (
                    <li key={a.id} className="flex gap-3 border-b border-line-soft px-4 py-3.5 last:border-b-0">
                      <span
                        aria-hidden="true"
                        className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", kind.tone)}
                      >
                        <Icon size={20} strokeWidth={2.4} />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="text-[13px] font-semibold uppercase tracking-wide text-muted">
                            {kind.label}
                          </span>
                          <span className="shrink-0 text-[14px] text-muted">{formatTime(a.createdAt)}</span>
                        </span>
                        <b className="leading-snug">{a.title}</b>
                        <span className="text-[15px] leading-snug">{a.body}</span>
                        <span className="text-[13px] text-muted">{channel(a)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      ) : null}
    </>
  );
}
