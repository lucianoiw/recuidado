"use client";

import { cn } from "./cn";

/** Single choice shown as chips. Uses radio semantics for screen readers. */
export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-2 text-[15px] font-bold">{label}</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup">
        {options.map((o) => {
          const on = o === value;
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o)}
              className={cn(
                "min-h-11 rounded-xl px-3.5 text-[16px] transition-colors",
                on
                  ? "border-2 border-brand bg-brand-soft font-bold text-brand"
                  : "border-[1.5px] border-[#cfc8ba] bg-surface font-semibold text-ink hover:border-brand",
              )}
            >
              {o}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Two or three tabs in a pill track. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="grid rounded-[14px] bg-line-soft p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-11 rounded-[11px] text-[15px] font-bold",
            o.value === value ? "bg-surface text-ink shadow-sm" : "text-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
