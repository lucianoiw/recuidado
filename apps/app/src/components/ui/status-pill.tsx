import type { ReactNode } from "react";
import { cn } from "./cn";

export type StatusTone = "ok" | "warn" | "danger" | "neutral";

const tones: Record<StatusTone, string> = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-neutral-soft text-muted",
};

/** A status label. Always carries a word, so it never depends on color alone. */
export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-3 py-1.5 text-[14px] font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
