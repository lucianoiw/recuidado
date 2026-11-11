"use client";

import { useState } from "react";
import { PlusIcon, XIcon, cn, inputClass } from "@/components/ui";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "8", "8h", "8:00" -> "08:00"; null when it is not a valid time. */
export function normalizeTime(raw: string): string | null {
  const m = /^(\d{1,2})(?:[:h](\d{2})?)?h?$/i.exec(raw.trim());
  if (!m) return null;
  const t = `${m[1].padStart(2, "0")}:${m[2] ?? "00"}`;
  return TIME.test(t) ? t : null;
}

/** Dose times as removable chips plus a "+ horário" button. */
export function TimeChips({
  times,
  onChange,
}: {
  times: string[];
  onChange: (times: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");

  function add() {
    const t = normalizeTime(value);
    if (t) onChange([...new Set([...times, t])].sort());
    setValue("");
    setAdding(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {times.map((t) => (
        <span
          key={t}
          className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-brand-soft pl-3.5 pr-1 text-[17px] font-bold text-brand"
        >
          {t}
          <button
            type="button"
            onClick={() => onChange(times.filter((x) => x !== t))}
            className="flex size-9 items-center justify-center rounded-lg hover:bg-white/60"
          >
            <XIcon size={16} />
            <span className="sr-only">Tirar {t}</span>
          </button>
        </span>
      ))}
      {adding ? (
        <span className="inline-flex items-center gap-2">
          <input
            type="time"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            aria-label="Novo horário"
            className={cn(inputClass, "h-11 w-32")}
          />
          <button
            type="button"
            onClick={add}
            className="min-h-11 rounded-xl bg-brand px-3.5 text-[16px] font-bold text-white"
          >
            Pôr
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-[#cfc8ba] px-3.5 text-[16px] font-bold text-muted"
        >
          <PlusIcon size={16} />
          horário
        </button>
      )}
    </div>
  );
}

