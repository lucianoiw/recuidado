"use client";

import Link from "next/link";
import { PhotoZoom } from "@/components/photo-zoom";
import { useEffect, useState } from "react";
import { BellIcon, buttonClass } from "@/components/ui";
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
      <header className="flex flex-col gap-1">
        <p className="text-[22px] text-muted">{meds.length === 1 ? "1 remédio" : `${meds.length} remédios`}</p>
        <h1 className="font-display text-[44px] leading-[1.02]">Meus remédios</h1>
      </header>

      {next ? (
        <section className="flex items-center gap-4 rounded-[28px] bg-surface px-5 py-5 shadow-[0_12px_28px_-16px_rgba(22,19,20,0.35)]">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-blush text-accent">
            <BellIcon size={30} strokeWidth={1.8} />
          </span>
          <span className="flex flex-col">
            <span className="text-[20px] text-muted">Próximo aviso</span>
            <span className="font-display text-[30px] leading-tight">{next}</span>
          </span>
        </section>
      ) : null}

      <ul className="flex flex-col overflow-hidden rounded-[28px] bg-surface">
        {meds.map((m) => (
          <li key={m.id} className="flex items-center gap-4 border-b border-line-soft px-5 py-5 last:border-b-0">
            {m.photoUrl ? <PhotoZoom src={m.photoUrl} name={m.name} className="h-32 w-24" /> : null}
            <div className="flex min-w-0 flex-col">
              <h2 className="font-display text-[32px] leading-tight">{m.name}</h2>
              {m.strength ? (
                <span className="font-sans text-[20px] text-muted">{m.strength.replace(/ /g, "\u00a0")}</span>
              ) : null}
              <span className="mt-1.5 font-display text-[24px] text-accent-ink">
                {joinTimes(m.times.map(shortTime))}
              </span>
            </div>
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
