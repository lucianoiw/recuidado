import { useEffect } from "react";

/** Scrolls back to the top whenever `key` changes: a new step in the same page reads as a new screen. */
export function useScrollTopOn(key: unknown) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [key]);
}
