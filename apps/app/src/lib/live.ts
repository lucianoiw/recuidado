"use client";

import { useEffect } from "react";
import { getChangeStamp } from "./api";
import { refreshMs } from "./demo";

/** How often an open screen asks whether anything changed. The answer is a few bytes. */
const CHECK_MS = 2_000;

/**
 * Calls `load` now, again within about 2 seconds of any change to the doses, medicines or
 * alerts (a "Tomei" on her phone shows on the family phone), and every 30 seconds anyway.
 * Checks pause while the screen is hidden and run at once when it comes back.
 */
export function useLiveRefresh(load: () => void): void {
  useEffect(() => {
    let stamp: string | null = null;
    let lastLoad = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const fullLoad = () => {
      lastLoad = Date.now();
      load();
    };

    const check = async () => {
      if (stopped) return;
      if (document.visibilityState === "visible") {
        try {
          const next = await getChangeStamp();
          if (stamp !== null && next !== stamp) fullLoad();
          stamp = next;
        } catch {
          // Offline for a moment: the next check tries again.
        }
        if (Date.now() - lastLoad >= refreshMs()) fullLoad();
      }
      if (!stopped) timer = setTimeout(check, CHECK_MS);
    };

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      clearTimeout(timer);
      fullLoad();
      timer = setTimeout(check, 0);
    };

    fullLoad();
    timer = setTimeout(check, 0);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);
}
