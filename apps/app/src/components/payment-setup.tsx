"use client";

import { Segmented, cn } from "@/components/ui";
import type { SplitMode } from "@/lib/api";

export interface PaymentPerson {
  /** Member id, or the name during the sign-up (before the members exist). */
  key: string;
  name: string;
  excluded: boolean;
  reason?: string | null;
  /** "(você)" next to the name. */
  me?: boolean;
}

const MODES: { value: SplitMode; label: string }[] = [
  { value: "split", label: "Dividir todo mês" },
  { value: "rotation", label: "Cada mês um compra" },
];

/** Keeps the saved order and adds the people not in it yet at the end. */
export function mergePeople(saved: PaymentPerson[], current: PaymentPerson[]): PaymentPerson[] {
  const byKey = new Map(current.map((p) => [p.key, p]));
  const kept = saved.filter((p) => byKey.has(p.key)).map((p) => ({ ...byKey.get(p.key)!, excluded: p.excluded, reason: p.reason }));
  const keys = new Set(kept.map((p) => p.key));
  return [...kept, ...current.filter((p) => !keys.has(p.key))];
}

function ArrowIcon({ up }: { up: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={up ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"} />
    </svg>
  );
}

/**
 * How the siblings pay what is not free: split every month by Pix, or each month one buys it all,
 * in the order chosen here. Anyone can stay out of the count (e.g. pays the health plan).
 */
export function PaymentSetup({
  mode,
  people,
  onChange,
  monthName,
  withReason = false,
}: {
  mode: SplitMode;
  people: PaymentPerson[];
  onChange: (mode: SplitMode, people: PaymentPerson[]) => void;
  /** "novembro": the month the first of the rotation buys. */
  monthName: string;
  withReason?: boolean;
}) {
  const rotation = mode === "rotation";
  const inCount = people.filter((p) => !p.excluded);

  function move(index: number, by: -1 | 1) {
    const list = [...people];
    const [item] = list.splice(index, 1);
    list.splice(index + by, 0, item!);
    onChange(mode, list);
  }
  function patch(index: number, change: Partial<PaymentPerson>) {
    onChange(mode, people.map((p, i) => (i === index ? { ...p, ...change } : p)));
  }

  let position = 0;
  return (
    <div className="flex flex-col gap-3">
      <Segmented label="Como vocês pagam" options={MODES} value={mode} onChange={(m) => onChange(m, people)} />
      <p className="text-[15px] leading-snug text-muted">
        {rotation
          ? `O primeiro da lista compra em ${monthName}, o segundo no mês seguinte, e assim por diante. O app avisa todo mundo de quem é a vez.`
          : "Quem compra recebe a parte dos outros por Pix. Cada um marca quando pagou."}
      </p>
      <ol className="flex flex-col overflow-hidden rounded-card border border-line-soft bg-surface">
        {people.map((p, i) => {
          const number = p.excluded ? null : ++position;
          return (
            <li key={p.key} className="flex flex-col gap-2 border-b border-line-soft px-3 py-3 last:border-b-0">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold",
                    p.excluded ? "bg-line-soft text-muted" : "bg-brand-soft text-brand",
                  )}
                >
                  {rotation && number ? `${number}º` : p.name.trim().charAt(0).toUpperCase()}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className={cn("truncate", p.excluded && "text-muted")}>
                    {p.name}
                    {p.me ? " (você)" : ""}
                  </b>
                  <span className="text-[14px] text-muted">
                    {p.excluded
                      ? p.reason?.trim() || "Fora da conta"
                      : rotation
                        ? number === 1
                          ? `Compra em ${monthName}`
                          : "Na fila"
                        : "Divide a conta"}
                  </span>
                </span>
                {rotation ? (
                  <span className="flex gap-1">
                    <button
                      type="button"
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                      className="flex size-11 items-center justify-center rounded-xl border border-line-soft disabled:opacity-30"
                    >
                      <ArrowIcon up />
                      <span className="sr-only">Subir {p.name}</span>
                    </button>
                    <button
                      type="button"
                      disabled={i === people.length - 1}
                      onClick={() => move(i, 1)}
                      className="flex size-11 items-center justify-center rounded-xl border border-line-soft disabled:opacity-30"
                    >
                      <ArrowIcon up={false} />
                      <span className="sr-only">Descer {p.name}</span>
                    </button>
                  </span>
                ) : null}
              </div>
              <label className="flex min-h-11 items-center gap-2.5 pl-11 text-[15px]">
                <input
                  type="checkbox"
                  checked={p.excluded}
                  onChange={(e) => patch(i, { excluded: e.target.checked })}
                  className="size-5 accent-brand"
                />
                Fica fora da conta
              </label>
              {withReason && p.excluded ? (
                <input
                  value={p.reason ?? ""}
                  maxLength={60}
                  placeholder="Por quê? Ex.: paga o plano de saúde"
                  aria-label={`Por que ${p.name} fica fora da conta`}
                  onChange={(e) => patch(i, { reason: e.target.value })}
                  className="ml-11 h-11 rounded-xl border-[1.5px] border-[#cfc8ba] bg-surface px-3 text-[15px] focus:border-brand focus:outline-none"
                />
              ) : null}
            </li>
          );
        })}
      </ol>
      {inCount.length === 0 ? (
        <p className="text-[15px] font-bold text-danger">Deixe pelo menos uma pessoa na conta.</p>
      ) : null}
    </div>
  );
}
