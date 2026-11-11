"use client";

import { useEffect, useState } from "react";
import { getAlerts, type FamilyAlert } from "./api";

const KEY = "recuidado:alerts-seen";

/** Newest alert this device has already shown on the alerts screen. */
function seenAt(): number {
  try {
    return Number(localStorage.getItem(KEY)) || 0;
  } catch {
    return 0;
  }
}

/** Called by the alerts screen: everything listed counts as seen. */
export function markAlertsSeen(alerts: FamilyAlert[]): void {
  const newest = alerts[0] ? new Date(alerts[0].createdAt).getTime() : 0;
  if (newest <= seenAt()) return;
  try {
    localStorage.setItem(KEY, String(newest));
  } catch {
    // Private mode: the badge just stays.
  }
}

/** How many alerts arrived since the alerts screen was last opened on this device. */
export function useUnseenAlerts(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = () =>
      getAlerts().then(
        (a) => {
          const seen = seenAt();
          if (alive) setCount(a.filter((x) => new Date(x.createdAt).getTime() > seen).length);
        },
        () => {},
      );
    load();
    const timer = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  return count;
}
