"use client";

import { useState, type ReactNode } from "react";
import { PhotoZoom } from "@/components/photo-zoom";
import { Button, CheckIcon, PillIcon } from "@/components/ui";
import { track } from "@/lib/analytics";
import { confirmDose, formatTime, notTakenDose, type Dose, type FamilyOverview } from "@/lib/api";

export interface EarlierGroup {
  time: string;
  doses: Dose[];
}

/**
 * Times of today that had passed when the family added the medicine. No reminder went out for
 * them, so her app asks, one time at a time: at 17h, the 8h and the 15h are two questions.
 */
export function useEarlierDoses(data: FamilyOverview | null, onAnswered?: () => void) {
  // Answered here, hidden before the reload arrives.
  const [answered, setAnswered] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);

  const groups = new Map<string, Dose[]>();
  for (const d of data?.today ?? []) {
    if (!d.beforeAdded || d.status !== "pending" || answered.has(d.id)) continue;
    groups.set(d.scheduledAt, [...(groups.get(d.scheduledAt) ?? []), d]);
  }
  const pending: EarlierGroup[] = [...groups.entries()].map(([at, doses]) => ({ time: formatTime(at), doses }));

  async function answer(doses: Dose[], took: boolean) {
    setBusy(true);
    try {
      await Promise.all(doses.map((d) => (took ? confirmDose(d.id) : notTakenDose(d.id))));
      track("earlier_dose_answered", { doses: doses.length, took });
      setAnswered((prev) => new Set([...prev, ...doses.map((d) => d.id)]));
      onAnswered?.();
    } finally {
      setBusy(false);
    }
  }

  return { pending, answered, busy, answer };
}

/** One question: "Tomou o remédio das 8:00?", with "Sim, tomei" and "Não tomei". */
export function EarlierQuestion({
  data,
  group,
  busy,
  onAnswer,
  top,
}: {
  data: FamilyOverview;
  group: EarlierGroup;
  busy: boolean;
  onAnswer: (took: boolean) => void;
  /** Above the card: the onboarding dots or the greeting. */
  top: ReactNode;
}) {
  const photo =
    group.doses.length === 1
      ? data.medications.find((m) => m.id === group.doses[0].medicationId)?.photoUrl
      : null;
  return (
    <div className="flex flex-1 flex-col gap-6">
      {top}
      <section className="flex flex-col items-center gap-1 rounded-[28px] bg-surface px-5 py-7 text-center shadow-[0_12px_28px_-16px_rgba(22,19,20,0.35)]">
        <p className="text-[24px] leading-snug">
          {group.doses.length > 1 ? "Já tomou os remédios das" : "Já tomou o remédio das"}
        </p>
        <p className="font-display text-[32px] text-accent-ink">{group.time}?</p>
        {photo ? (
          <PhotoZoom src={photo} name={group.doses[0].medicationName} className="my-3 h-44 w-32" />
        ) : (
          <span className="my-3 flex size-28 items-center justify-center rounded-full bg-blush text-accent">
            <PillIcon size={52} strokeWidth={1.8} />
          </span>
        )}
        <ul className="flex w-full flex-col gap-3">
          {group.doses.map((d) => (
            <li key={d.id} className="flex flex-col items-center">
              <h2
                className={
                  group.doses.length > 1
                    ? "font-display text-[32px] leading-tight"
                    : "font-display text-[40px] leading-tight"
                }
              >
                {d.medicationName}
              </h2>
              {d.strength ? (
                <span className="font-sans text-[22px] text-muted">{d.strength.replace(/ /g, " ")}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      <div className="mt-auto flex flex-col gap-3">
        <Button size="xl" onClick={() => onAnswer(true)} disabled={busy} className="font-display">
          <CheckIcon size={32} />
          {busy ? "Anotando..." : "Sim, tomei"}
        </Button>
        <Button variant="secondary" size="lg" onClick={() => onAnswer(false)} disabled={busy}>
          Não tomei
        </Button>
      </div>
    </div>
  );
}
