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

function groupByTime(doses: Dose[]): { time: string; doses: Dose[] }[] {
  const groups = new Map<string, Dose[]>();
  for (const d of doses) groups.set(d.scheduledAt, [...(groups.get(d.scheduledAt) ?? []), d]);
  return [...groups.entries()].map(([at, ds]) => ({ time: formatTime(at), doses: ds }));
}

function namesOf(doses: Dose[]): string {
  const names = doses.map(doseName);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} e ${names.at(-1)}` : names[0];
}

export function PatientView() {
  const [data, setData] = useState<FamilyOverview | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  const [justTaken, setJustTaken] = useState<Dose[] | null>(null);

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
  // Doses at the same time are taken together: the earliest time whose doses are not taken yet.
  const first = data.today.find(
    (d) => d.status !== "taken" && new Date(d.scheduledAt).getTime() <= now,
  );
  const due = first
    ? data.today.filter((d) => d.status !== "taken" && d.scheduledAt === first.scheduledAt)
    : [];
  const later = groupByTime(
    data.today.filter((d) => d.status === "pending" && new Date(d.scheduledAt).getTime() > now),
  );
  const next = later[0];

  async function confirm(doses: Dose[]) {
    setBusy(true);
    try {
      await Promise.all(doses.map((d) => confirmDose(d.id)));
      setJustTaken(doses);
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
            Anotei {justTaken.length > 1 ? "os remédios" : doseName(justTaken[0])} das{" "}
            {formatTime(justTaken[0].scheduledAt)}.
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
            <p className="text-[28px] font-bold leading-tight">{namesOf(next.doses)}</p>
            <p className="text-[24px] font-semibold text-brand">às {next.time}</p>
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

      {due.length > 0 ? (
        <Card className="flex flex-col gap-5 border-2 border-line px-4 py-6" aria-live="polite">
          <p className="flex items-center gap-2.5 text-[26px] font-bold text-brand">
            <ClockIcon size={30} strokeWidth={2.2} />
            Agora, {formatTime(due[0].scheduledAt)}
          </p>
          <ul className="flex flex-col gap-3.5">
            {due.map((d) => (
              <li key={d.id} className="flex items-center gap-4">
                <span className="flex size-16 shrink-0 items-center justify-center rounded-[18px] bg-brand-soft text-brand">
                  <PillIcon size={36} />
                </span>
                <h2 className="text-[28px] font-bold leading-tight">{doseName(d)}</h2>
              </li>
            ))}
          </ul>
          <Button size="xl" onClick={() => confirm(due)} disabled={busy}>
            <CheckIcon size={32} />
            {busy ? "Anotando..." : due.length > 1 ? `Tomei os ${due.length}` : "Tomei o remédio"}
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
              Próximo: {namesOf(next.doses)} às {next.time}
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
            {later.map((g) => (
              <li key={g.time} className="flex items-start justify-between gap-3 rounded-card bg-surface px-4 py-4">
                <span className="flex flex-col font-semibold">
                  {g.doses.map((d) => (
                    <span key={d.id}>{doseName(d)}</span>
                  ))}
                </span>
                <span className="font-bold">{g.time}</span>
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
