"use client";

import { useCallback, useEffect, useState } from "react";
import { captureError } from "./analytics";
import { getFamily, type FamilyOverview } from "./api";
import { refreshMs } from "./demo";

/** Loads GET /family and refreshes it every 30 seconds (every 3 during a demo run). */
export function useFamily() {
  const [data, setData] = useState<FamilyOverview | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(0);

  const load = useCallback(() => {
    getFamily().then(
      (d) => {
        setData(d);
        setNow(Date.now());
        setError(false);
      },
      (e) => {
        captureError(e, { hook: "useFamily" });
        setError(true);
      },
    );
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      load();
      timer = setTimeout(tick, refreshMs());
    };
    tick();
    return () => clearTimeout(timer);
  }, [load]);

  return { data, error, now, reload: load };
}

export const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** "Losartana 50 mg", keeping the strength on one line. */
export function medLabel(name: string, strength: string | null): string {
  return [name, strength?.replace(/ /g, " ")].filter(Boolean).join(" ");
}
