"use client";

import { useEffect, useId, useState } from "react";
import { cn, inputClass } from "@/components/ui";
import { searchMedications, type MedResult } from "@/lib/med-search";

/** Name field that searches the CMED list while typing (debounced) and lets the family pick one. */
export function MedSearch({
  value,
  onValue,
  onPick,
  invalid,
}: {
  value: string;
  onValue: (name: string) => void;
  onPick: (medicine: MedResult) => void;
  invalid?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [found, setFound] = useState<{ q: string; items: MedResult[] }>({ q: "", items: [] });

  useEffect(() => {
    if (!open || value.trim().length < 2) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      searchMedications(value, ctrl.signal)
        .then((items) => setFound({ q: value, items }))
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [value, open]);

  const options = open && value.trim().length >= 2 && found.q === value ? found.items : [];
  const shown = options.length > 0;

  function pick(m: MedResult) {
    onPick(m);
    setOpen(false);
    setActive(-1);
  }

  return (
    <div className="relative flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-[15px] font-bold">
        Nome do remédio
      </label>
      <input
        id={id}
        role="combobox"
        aria-expanded={shown}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={shown && active >= 0 ? `${id}-${active}` : undefined}
        aria-invalid={invalid}
        autoComplete="off"
        placeholder="Comece a digitar, ex.: Losartana"
        className={inputClass}
        value={value}
        onChange={(e) => {
          onValue(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (!shown) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % options.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a <= 0 ? options.length - 1 : a - 1));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            pick(options[active]!);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {shown ? (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-[22rem] overflow-y-auto rounded-[14px] border border-line-soft bg-surface shadow-[0_12px_32px_rgba(22,32,31,0.14)]"
        >
          {options.map((m, i) => {
            const free = m.strengths.some((s) => s.freeAt.length > 0);
            return (
              <li
                key={`${m.kind} ${m.name} ${m.laboratory ?? ""}`}
                id={`${id}-${i}`}
                role="option"
                aria-selected={i === active}
                // mousedown keeps the input from blurring before the pick.
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(m);
                }}
                className={cn(
                  "flex min-h-14 cursor-pointer items-center justify-between gap-3 border-b border-line-soft px-3.5 py-2 last:border-b-0",
                  i === active && "bg-brand-soft",
                )}
              >
                <span className="flex min-w-0 flex-col">
                  <b className="line-clamp-2 text-[17px] leading-snug">{m.name}</b>
                  <span className="truncate text-[14px] text-muted">
                    {m.kind === "generic" ? "Genérico" : m.activeIngredient}
                  </span>
                </span>
                {free ? (
                  <span className="whitespace-nowrap rounded-full bg-brand-soft px-2.5 py-1 text-[13px] font-bold text-brand">
                    Pode ser grátis
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
