"use client";

import { useCallback, useEffect, useState } from "react";
import { captureError } from "./analytics";
import { getMonth, type MonthSummary } from "./api";

/** Loads GET /family/month once; call reload after a change. */
export function useMonth() {
  const [data, setData] = useState<MonthSummary | null>(null);
  const [error, setError] = useState(false);

  const reload = useCallback(() => {
    getMonth().then(
      (d) => {
        setData(d);
        setError(false);
      },
      (e) => {
        captureError(e, { hook: "useMonth" });
        setError(true);
      },
    );
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, reload };
}
