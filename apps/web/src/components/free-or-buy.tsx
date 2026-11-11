"use client";

import { cn } from "@/components/ui";

/** Lets the family pick, per free medication, whether to get it free or buy it. */
export function FreeOrBuy({
  name,
  free,
  onChange,
}: {
  name: string;
  free: boolean;
  onChange: (free: boolean) => void;
}) {
  const option = (value: boolean, label: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={free === value}
      onClick={() => onChange(value)}
      className={cn(
        "min-h-11 flex-1 whitespace-nowrap rounded-[9px] px-2.5 text-[15px] font-bold",
        free === value
          ? cn("bg-surface shadow-sm", value ? "text-brand" : "text-warn")
          : "text-muted",
      )}
    >
      {label}
    </button>
  );
  return (
    <div role="radiogroup" aria-label={`Como conseguir ${name}`} className="flex w-full rounded-xl bg-line-soft p-[3px]">
      {option(true, "Pegar grátis")}
      {option(false, "Comprar")}
    </div>
  );
}
