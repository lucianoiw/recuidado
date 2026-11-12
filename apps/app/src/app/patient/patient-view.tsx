"use client";

import { PhotoZoom } from "@/components/photo-zoom";
import { InstallAppButton } from "@/components/install-app";
import Link from "next/link";
import { useCallback, useState } from "react";
import { EnableNotifications } from "@/components/enable-notifications";
import { BellIcon, Button, Card, CheckIcon, PhoneIcon, PillIcon, buttonClass } from "@/components/ui";
import { captureError, identifyMember, track } from "@/lib/analytics";
import { useLiveRefresh } from "@/lib/live";
import { PatientWelcome, usePatientReady } from "./patient-welcome";
import { CallLink, canCall } from "@/components/call-link";
import { callName, confirmDose, formatTime, getFamily, type Dose, type FamilyOverview } from "@/lib/api";

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
  const ready = usePatientReady();

  const load = useCallback(() => {
    getFamily().then(
      (d) => {
        identifyMember(d.patient.id, "patient", d.familyId);
        setData(d);
        setNow(Date.now());
        setError(false);
      },
      (e) => {
        captureError(e, { screen: "patient" });
        setError(true);
      },
    );
  }, []);

  useLiveRefresh(load);

  if (error) {
    return <p className="text-[24px] text-muted">Sem conexão. Tente de novo em instantes.</p>;
  }
  if (!data || ready === null) return <p className="text-[24px] text-muted">Carregando...</p>;
  if (!ready) return <PatientWelcome data={data} />;

  const patientName = callName(data.patient);
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
      track("dose_confirm_tapped", { doses: doses.length, medications: doses.map((d) => d.medicationName).join(", ") });
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
          <span className="flex size-32 items-center justify-center rounded-full bg-ok-soft text-ok">
            <CheckIcon size={64} strokeWidth={2.2} aria-hidden={false} role="img" aria-label="Confirmado" />
          </span>
          <h1 className="font-display text-[44px] leading-[1.02]">
            Pronto,
            <br />
            {patientName}!
          </h1>
          <p className="text-[26px] leading-snug">
            Anotei {justTaken.length > 1 ? "os remédios" : doseName(justTaken[0])}
            {` das\u00a0${formatTime(justTaken[0].scheduledAt)}.`}
            {names.length > 0 ? (
              <>
                <br />
                {names.join(" e ")} {names.length > 1 ? "já sabem" : "já sabe"}.
              </>
            ) : null}
          </p>
        </div>
        {next ? (
          <Card className="flex flex-col gap-1 p-5 shadow-[0_12px_28px_-16px_rgba(22,19,20,0.35)]">
            <p className="text-[22px] text-muted">Próximo remédio</p>
            <ul className="font-display text-[32px] leading-tight">
              {next.doses.map((d) => (
                <li key={d.id}>{doseName(d)}</li>
              ))}
            </ul>
            <p className="font-display text-[28px] text-accent-ink">às {next.time}</p>
          </Card>
        ) : null}
        <Button variant="secondary" size="lg" onClick={() => setJustTaken(null)}>
          Voltar
        </Button>
      </div>
    );
  }

  // Caregivers with a phone. One: call straight away. More: a screen with one button each.
  const callable = data.caregivers.filter(canCall);
  // Photo of the real box or pill, only when the family took one. Never a generic picture.
  const photoOf = new Map(data.medications.map((m) => [m.id, m.photoUrl ?? null]));

  return (
    <>
      {due.length > 0 ? (
        <header className="flex flex-col gap-1">
          <p className="text-[22px] text-muted">
            {greeting()}, {patientName}
          </p>
          <h1 className="font-display text-[44px] leading-[1.02]">Hora do remédio</h1>
        </header>
      ) : (
        <header className="flex flex-col gap-1">
          <p className="text-[22px] text-muted">
            {greeting()}, {patientName}
          </p>
          <h1 className="font-display text-[44px] leading-[1.02]">Tudo certo por agora</h1>
        </header>
      )}

      {due.length > 0 ? (
        <section
          aria-live="polite"
          className="flex flex-col items-center gap-1 rounded-[28px] bg-surface px-5 py-7 text-center shadow-[0_12px_28px_-16px_rgba(22,19,20,0.35)]"
        >
          <p className="font-display text-[32px] text-accent-ink">{formatTime(due[0].scheduledAt)}</p>
          {due.length === 1 && photoOf.get(due[0].medicationId) ? (
            <PhotoZoom src={photoOf.get(due[0].medicationId)!} name={due[0].medicationName} className="my-3 h-44 w-32" />
          ) : (
            <span className="my-3 flex size-28 items-center justify-center rounded-full bg-blush text-accent">
              <BellIcon size={52} strokeWidth={1.8} />
            </span>
          )}
          <ul className="flex w-full flex-col gap-3">
            {due.map((d) => (
              <li key={d.id} className="flex flex-col items-center">
                <h2 className={due.length > 1 ? "font-display text-[32px] leading-tight" : "font-display text-[40px] leading-tight"}>
                  {d.medicationName}
                </h2>
                {d.strength ? (
                  <span className="font-sans text-[22px] text-muted">{d.strength.replace(/ /g, "\u00a0")}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {due.length > 0 ? (
        <Button size="xl" onClick={() => confirm(due)} disabled={busy} className="font-display">
          <CheckIcon size={32} />
          {busy ? "Anotando..." : due.length > 1 ? `Tomei os ${due.length}` : "Tomei"}
        </Button>
      ) : (
        <section className="flex flex-col items-center gap-3 rounded-[28px] bg-surface px-5 py-7 text-center shadow-[0_12px_28px_-16px_rgba(22,19,20,0.35)]">
          <span className="flex size-24 items-center justify-center rounded-full bg-ok-soft text-ok">
            <CheckIcon size={48} strokeWidth={2.2} />
          </span>
          {next ? (
            <>
              <p className="text-[22px] text-muted">Próximo remédio</p>
              <p className="font-display text-[32px] leading-tight">{namesOf(next.doses)}</p>
              <p className="font-display text-[28px] text-accent-ink">às {next.time}</p>
            </>
          ) : (
            <p className="font-display text-[32px] leading-tight">Não tem mais remédio hoje.</p>
          )}
        </section>
      )}

      {later.length > 0 ? (
        <section className="flex flex-col gap-2.5">
          <h2 className="font-display text-[28px]">Mais tarde hoje</h2>
          <ul className="flex flex-col gap-2.5">
            {later.map((g) => (
              <li key={g.time} className="flex items-start justify-between gap-3 rounded-card bg-surface px-4 py-4">
                <span className="flex min-w-0 flex-col gap-1 text-[19px] font-semibold leading-snug">
                  {g.doses.map((d) => (
                    <span key={d.id}>{doseName(d)}</span>
                  ))}
                </span>
                <span className="font-display text-[24px] text-accent-ink">{g.time}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-auto flex flex-col gap-3 pt-2">
        <Link href="/patient/remedios" className={buttonClass({ variant: "secondary", size: "lg" })}>
          <PillIcon size={26} />
          Meus remédios
        </Link>
        {callable.length === 1 ? (
          <CallLink member={callable[0]} className={buttonClass({ variant: "secondary", size: "lg" })}>
            <PhoneIcon size={26} />
            <span className="whitespace-nowrap">Ligar para {callable[0].name.trim().split(/\s+/)[0]}</span>
          </CallLink>
        ) : callable.length > 1 ? (
          <Link href="/patient/ligar" className={buttonClass({ variant: "secondary", size: "lg" })}>
            <PhoneIcon size={26} />
            Ligar para a família
          </Link>
        ) : null}
        <EnableNotifications memberId={data.patient.id} label="Receber lembretes no celular" large />
        <InstallAppButton />
      </div>
    </>
  );
}
