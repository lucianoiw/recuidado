"use client";

import { Field } from "@/components/ui";

const BOXES = [30, 60];

/** Pills at home, with quick "+30" and "+60" for a new box. */
export function StockField({
  value,
  onValue,
  invalid,
}: {
  value: string;
  onValue: (value: string) => void;
  invalid?: boolean;
}) {
  const current = /^\d+$/.test(value.trim()) ? Number(value) : 0;
  return (
    <div className="flex flex-col gap-2">
      <Field
        label="Comprimidos em casa"
        value={value}
        onValue={(v) => onValue(v.replace(/\D/g, "").slice(0, 4))}
        inputMode="numeric"
        autoComplete="off"
        placeholder="Ex.: 30"
        aria-invalid={invalid}
        hint="Opcional. Com isso a gente avisa a família quando estiver acabando."
      />
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Somar uma caixa nova">
        <span className="text-[14px] text-muted">Caixa nova:</span>
        {BOXES.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onValue(String(Math.min(1000, current + n)))}
            className="inline-flex min-h-11 items-center rounded-xl border-[1.5px] border-line bg-surface px-3 text-[16px] font-bold text-ink"
          >
            +{n}
          </button>
        ))}
      </div>
    </div>
  );
}
