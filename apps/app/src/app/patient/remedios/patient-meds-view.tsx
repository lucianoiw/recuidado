"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BellIcon, Card, ClockIcon, ScreenHeader, buttonClass } from "@/components/ui";
import { captureError, track } from "@/lib/analytics";
import { formatTime, getFamily, type FamilyOverview } from "@/lib/api";

/** "08:00" -> "8:00", as Dona Maria reads it. */
function shortTime(t: string): string {
  return t.replace(/^0(\d)/, "$1");
}

function joinTimes(list: string[]): string {
  return list.length > 1 ? `${list.slice(0, -1).join(", ")} e ${list.at(-1)}` : (list[0] ?? "");
}

/** Next reminder: a later dose today, else the first time tomorrow. */
function nextReminder(data: FamilyOverview, now: number): string | null {
  const later = data.today.find((d) => d.status === "pending" && new Date(d.scheduledAt).getTime() > now);
  if (later) return `Hoje às ${formatTime(later.scheduledAt)}`;
  const first = data.medications.flatMap((m) => m.times).sort()[0];
  return first ? `Amanhã às ${shortTime(first)}` : null;
}

/** Dona Maria's own list: each medicine, its dose and the times the phone rings. Read only. */
export function PatientMedsView() {
  const [data, setData] = useState<FamilyOverview | null>(null);
  const [now, setNow] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    getFamily().then(
      (d) => {
        setData(d);
        setNow(Date.now());
        track("patient_meds_viewed", { medications: d.medications.length });
      },
      (e) => {
        captureError(e, { screen: "patient_meds" });
        setError(true);
      },
    );
  }, []);

  if (error) return <p className="text-[24px] text-muted">Sem conexão. Tente de novo em instantes.</p>;
  if (!data) return <p className="text-[24px] text-muted">Carregando...</p>;

  const meds = data.medications.filter((m) => m.times.length > 0);
  const next = nextReminder(data, now);
  const host = data.caregivers[0]?.name.trim().split(/\s+/)[0];

  return (
    <>
      <ScreenHeader
        audience="patient"
        eyebrow={meds.length === 1 ? "1 remédio" : `${meds.length} remédios`}
        title="Meus remédios"
      />

      {next ? (
        <Card className="flex items-center gap-3.5 px-5 py-5">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-blush text-accent-ink">
            <BellIcon size={30} strokeWidth={2.2} />
          </span>
          <span className="flex flex-col">
            <span className="text-[22px] text-muted">Próximo aviso</span>
            <b className="text-[28px] leading-tight">{next}</b>
          </span>
        </Card>
      ) : null}

      <ul className="flex flex-col gap-3">
        {meds.map((m) => (
          <li key={m.id}>
            <Card className="flex flex-col gap-3 px-5 py-5">
              {m.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- signed R2 link, taken by the family
                <img
                  src={m.photoUrl}
                  alt={`Foto de ${m.name}`}
                  className="h-44 w-full rounded-2xl border border-line bg-surface object-contain"
                />
              ) : null}
              <div className="flex items-start gap-2.5">
                <div className="flex min-w-0 flex-col">
                  <h2 className="text-[30px] font-bold leading-tight">{m.name}</h2>
                  {m.strength ? (
                    <span className="text-[22px] text-muted">{m.strength.replace(/ /g, " ")}</span>
                  ) : null}
                </div>
              </div>
              <p className="flex items-center gap-2.5 border-t border-line-soft pt-3 text-[24px] leading-snug">
                <ClockIcon size={26} className="shrink-0 text-accent-ink" />
                <span>
                  Às <b>{joinTimes(m.times.map(shortTime))}</b>
                </span>
              </p>
            </Card>
          </li>
        ))}
      </ul>

      <p className="text-[22px] leading-snug text-muted">
        {host ? `Para mudar algum remédio, fale com ${host}.` : "Para mudar algum remédio, fale com a família."} Só o
        médico muda a dose.
      </p>

      <Link href="/patient" className={buttonClass({ variant: "secondary", size: "lg", className: "mt-auto" })}>
        Voltar
      </Link>
    </>
  );
}
