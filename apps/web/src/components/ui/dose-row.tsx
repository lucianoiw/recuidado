import type { ReactNode } from "react";
import { StatusPill, type StatusTone } from "./status-pill";

export type DoseStatus = "taken" | "missed" | "pending" | "upcoming";

const statusTone: Record<DoseStatus, StatusTone> = {
  taken: "ok",
  missed: "danger",
  pending: "warn",
  upcoming: "neutral",
};

const statusLabel: Record<DoseStatus, string> = {
  taken: "Tomou",
  missed: "Não tomou",
  pending: "Esperando",
  upcoming: "Mais tarde",
};

/** One dose in a list: medication, time and status. Use inside a DoseList. */
export function DoseRow({
  name,
  time,
  status,
  statusText,
}: {
  name: string;
  time: string;
  status: DoseStatus;
  /** Overrides the default label, e.g. "Tomou 8:34". */
  statusText?: string;
}) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-line-soft py-3 last:border-b-0">
      <div className="flex min-w-0 flex-col">
        <span className="font-semibold">{name}</span>
        <span className="text-[15px] text-muted">{time}</span>
      </div>
      <StatusPill tone={statusTone[status]}>{statusText ?? statusLabel[status]}</StatusPill>
    </li>
  );
}

export function DoseList({ children }: { children: ReactNode }) {
  return <ul className="flex flex-col rounded-card bg-surface px-4 py-1">{children}</ul>;
}
