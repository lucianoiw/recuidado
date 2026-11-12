import type { ReactNode } from "react";

/** Title block for the family tabs. */
export function PageTitle({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <header className="flex flex-col gap-1">
      <h1 className="font-display text-[34px] leading-[1.05]">{title}</h1>
      {subtitle ? <p className="text-[16px] text-muted">{subtitle}</p> : null}
    </header>
  );
}
