"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EnableNotifications } from "@/components/enable-notifications";
import { Button, Card, CheckIcon, ClockIcon, PhoneIcon, PillIcon, ScreenHeader, buttonClass } from "@/components/ui";
import { captureError, identifyMember, track } from "@/lib/analytics";
import { refreshMs } from "@/lib/demo";
import { PatientWelcome, usePatientReady } from "./patient-welcome";
import { callName, confirmDose, formatTime, getFamily, telHref, type Dose, type FamilyOverview } from "@/lib/api";

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

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      load();
      timer = setTimeout(tick, refreshMs());
    };
    tick();
    return () => clearTimeout(timer);
  }, [load]);

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
          <span className="flex size-36 items-center justify-center rounded-full bg-brand text-white">
            <CheckIcon size={84} aria-hidden={false} role="img" aria-label="Confirmado" />
          </span>
          <h1 className="text-[40px] font-bold leading-tight">
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
          <Card className="flex flex-col gap-1 p-5">
            <p className="text-muted">Próximo remédio</p>
            <ul className="text-[28px] font-bold leading-tight">
              {next.doses.map((d) => (
                <li key={d.id}>{doseName(d)}</li>
              ))}
            </ul>
            <p className="text-[24px] font-semibold text-brand">às {next.time}</p>
          </Card>
        ) : null}
        <Button variant="secondary" size="lg" onClick={() => setJustTaken(null)}>
          Voltar
        </Button>
      </div>
    );
  }

  // Caregivers with a phone. One: call straight away. More: a screen with one button each.
  const callable = data.caregivers.filter((c) => telHref(c) !== null);
  // Photo of the real box or pill, only when the family took one. Never a generic picture.
  const photoOf = new Map(data.medications.map((m) => [m.id, m.photoUrl ?? null]));

  return (
    <>
      <ScreenHeader audience="patient" eyebrow={todayLabel()} title={
          <>
            {greeting()},
            <br />
            {patientName}
          </>
        } />

      {due.length > 0 ? (
        <Card className="flex flex-col gap-5 border-2 border-line px-4 py-6" aria-live="polite">
          <p className="flex items-center gap-2.5 text-[26px] font-bold text-brand">
            <ClockIcon size={30} strokeWidth={2.2} />
            Agora, {formatTime(due[0].scheduledAt)}
          </p>
          <ul className="flex flex-col gap-3.5">
            {due.map((d) => (
              <li key={d.id} className="flex flex-col gap-2.5">
                {photoOf.get(d.medicationId) ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed R2 link
                  <img
                    src={photoOf.get(d.medicationId)!}
                    alt={`Foto de ${d.medicationName}`}
                    className="h-52 w-full rounded-2xl border border-line bg-surface object-contain"
                  />
                ) : null}
                <div className="flex items-start gap-2.5">
                  <span className="flex h-9 shrink-0 items-center text-brand">
                    <PillIcon size={28} />
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <h2 className="text-[30px] font-bold leading-tight">{d.medicationName}</h2>
                    {d.strength ? (
                      <span className="text-[22px] text-muted">{d.strength.replace(/ /g, "\u00a0")}</span>
                    ) : null}
                  </div>
                </div>
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

      <div className="mt-auto flex flex-col gap-3 pt-2">
        <Link href="/patient/remedios" className={buttonClass({ variant: "secondary", size: "lg" })}>
          <PillIcon size={26} />
          Meus remédios
        </Link>
        {callable.length === 1 ? (
          <a href={telHref(callable[0])!} className={buttonClass({ variant: "secondary", size: "lg" })}>
            <PhoneIcon size={26} />
            Ligar para {callable[0].name.trim().split(/\s+/)[0]}
          </a>
        ) : callable.length > 1 ? (
          <Link href="/patient/ligar" className={buttonClass({ variant: "secondary", size: "lg" })}>
            <PhoneIcon size={26} />
            Ligar para a família
          </Link>
        ) : null}
        <EnableNotifications memberId={data.patient.id} label="Receber lembretes no celular" large />
      </div>
    </>
  );
}
