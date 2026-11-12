"use client";

import { useState, type ReactNode } from "react";
import { telHref, type Member } from "@/lib/api";

/** True when the app can show a call button for this person (the demo family included). */
export function canCall(m: Member | null | undefined): boolean {
  return !!m && (telHref(m) !== null || m.hasPhone === true);
}

/**
 * Call button for one person. The demo family's phones come masked, so there the button stays on
 * screen (the demo shows the real layout) and says the call does not go out instead of dialing.
 */
export function CallLink({
  member,
  className,
  onClick,
  children,
}: {
  member: Member;
  className?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const [said, setSaid] = useState(false);
  const tel = telHref(member);
  if (tel) {
    return (
      <a href={tel} onClick={onClick} className={className}>
        {children}
      </a>
    );
  }
  if (!member.hasPhone) return null;
  return (
    <button
      type="button"
      className={className}
      aria-live="polite"
      onClick={() => {
        onClick?.();
        setSaid(true);
        setTimeout(() => setSaid(false), 3000);
      }}
    >
      {said ? "Na demonstração a ligação não sai" : children}
    </button>
  );
}
