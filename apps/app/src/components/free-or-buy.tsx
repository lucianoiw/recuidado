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
        "min-h-10 flex-1 whitespace-nowrap rounded-full px-2.5 text-[15px] font-semibold",
        free === value
          ? "bg-ink text-white"
          : "text-muted",
      )}
    >
      {label}
    </button>
  );
  return (
    <div role="radiogroup" aria-label={`Como conseguir ${name}`} className="flex w-full rounded-full bg-cream p-1">
      {option(true, "Pegar grátis")}
      {option(false, "Comprar")}
    </div>
  );
}
