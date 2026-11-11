"use client";

import { useCallback, useEffect, useState } from "react";
import { EnableNotifications } from "@/components/enable-notifications";
import { Button, Card, CheckIcon, ClockIcon, PillIcon, ScreenHeader } from "@/components/ui";
import { confirmDose, formatTime, getFamily, type Dose, type FamilyOverview } from "@/lib/api";

function todayLabel(): string {
  const text = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  return text.charAt(0).toUpperCase() + text.slice(1).replace("-feira", "");
}

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "numeric", hourCycle: "h23" }).format(
      new Date(),
    ),
  );
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function doseName(d: Dose): string {
  // Keep "50 mg" on one line.
  return [d.medicationName, d.strength?.replace(/ /g, "\u00a0")].filter(Boolean).join(" ");
}

export function PatientView() {
  const [data, setData] = useState<FamilyOverview | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  const [justTaken, setJustTaken] = useState<Dose | null>(null);

  const load = useCallback(() => {
    getFamily().then(
      (d) => {
        setData(d);
        setNow(Date.now());
        setError(false);
      },
      () => setError(true),
    );
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  if (error) {
    return <p className="text-[24px] text-muted">Sem conexão. Tente de novo em instantes.</p>;
  }
  if (!data) return <p className="text-[24px] text-muted">Carregando...</p>;

  const patientName = data.patient.name;
  // The dose to confirm: the earliest one not taken whose time has come.
  const due = data.today.find(
    (d) => d.status !== "taken" && new Date(d.scheduledAt).getTime() <= now,
  );
  const later = data.today.filter(
    (d) => d.status === "pending" && new Date(d.scheduledAt).getTime() > now,
  );
  const next = later[0];

  async function confirm(dose: Dose) {
    setBusy(true);
    try {
      await confirmDose(dose.id);
      setJustTaken(dose);
      load();
    } finally {
      setBusy(false);
    }
  }

  if (justTaken) {
    const names = data.caregivers.map((c) => c.name.split(" ")[0]);
    return (
      <div className="flex flex-1 flex-col gap-6">
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
          <span className="flex size-36 items-center justify-center rounded-full bg-brand text-white">
            <CheckIcon size={84} aria-hidden={false} role="img" aria-label="Confirmado" />
          </span>
          <h1 className="text-[40px] font-bold leading-tight">Pronto, {patientName}!</h1>
          <p className="text-[26px] leading-snug">
            Anotei {doseName(justTaken)} das {formatTime(justTaken.scheduledAt)}.
            {names.length > 0 ? (
              <>
                <br />
                {names.join(" e ")} {names.length > 1 ? "já sabem" : "já sabe"}.
              </>
            ) : null}
          </p>
        </div>
        {next ? (
          <Card className="flex flex-col gap-1 p-5">
            <p className="text-muted">Próximo remédio</p>
            <p className="text-[28px] font-bold leading-tight">{doseName(next)}</p>
            <p className="text-[24px] font-semibold text-brand">às {formatTime(next.scheduledAt)}</p>
          </Card>
        ) : null}
        <Button variant="secondary" size="lg" onClick={() => setJustTaken(null)}>
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <>
      <ScreenHeader audience="patient" eyebrow={todayLabel()} title={`${greeting()}, ${patientName}`} />

      {due ? (
        <Card className="flex flex-col gap-5 border-2 border-line px-4 py-6" aria-live="polite">
          <p className="flex items-center gap-2.5 text-[26px] font-bold text-brand">
            <ClockIcon size={30} strokeWidth={2.2} />
            Agora, {formatTime(due.scheduledAt)}
          </p>
          <div className="flex items-center gap-4">
            <span className="flex size-18 shrink-0 items-center justify-center rounded-[20px] bg-brand-soft text-brand">
              <PillIcon size={40} />
            </span>
            <h2 className="text-[32px] font-bold leading-tight">{doseName(due)}</h2>
          </div>
          <Button size="xl" onClick={() => confirm(due)} disabled={busy}>
            <CheckIcon size={32} />
            {busy ? "Anotando..." : "Tomei o remédio"}
          </Button>
        </Card>
      ) : (
        <Card className="flex flex-col gap-2 px-5 py-6">
          <p className="flex items-center gap-2.5 text-[30px] font-bold leading-tight text-brand">
            <CheckIcon size={34} />
            Tudo certo por agora
          </p>
          {next ? (
            <p className="text-[24px]">
              Próximo: {doseName(next)} às {formatTime(next.scheduledAt)}
            </p>
          ) : (
            <p className="text-[24px]">Não tem mais remédio hoje.</p>
          )}
        </Card>
      )}

      {later.length > 0 ? (
        <section className="flex flex-col gap-2.5">
          <h2 className="text-[24px] font-bold">Mais tarde hoje</h2>
          <ul className="flex flex-col gap-2.5">
            {later.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 rounded-card bg-surface px-4 py-4">
                <span className="font-semibold">{doseName(d)}</span>
                <span className="font-bold">{formatTime(d.scheduledAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-auto pt-2">
        <EnableNotifications memberId={data.patient.id} label="Receber lembretes no celular" large />
      </div>
    </>
  );
}
