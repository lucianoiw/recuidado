"use client";

import { useId, useState } from "react";
import { cn, inputClass } from "@/components/ui";
import { searchMedications, type MedOption } from "@/lib/med-search";

/** Name field that suggests medications while typing; picking one also fills the dose. */
export function MedSearch({
  value,
  onValue,
  onPick,
  invalid,
}: {
  value: string;
  onValue: (name: string) => void;
  onPick: (option: MedOption) => void;
  invalid?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const options = open ? searchMedications(value) : [];
  const shown = options.length > 0;

  function pick(o: MedOption) {
    onPick(o);
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
          className="absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-[14px] border border-line-soft bg-surface shadow-[0_12px_32px_rgba(22,32,31,0.14)]"
        >
          {options.map((o, i) => (
            <li
              key={`${o.name} ${o.strength}`}
              id={`${id}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown keeps the input from blurring before the pick.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o);
              }}
              className={cn(
                "flex min-h-12 cursor-pointer items-center justify-between gap-3 border-b border-line-soft px-3.5 text-[17px] last:border-b-0",
                i === active && "bg-brand-soft",
              )}
            >
              <b className="truncate">{o.name}</b>
              <span className="whitespace-nowrap text-muted">{o.strength}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
