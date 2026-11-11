"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** window.location.origin on the client, "" while rendering on the server. */
export function useOrigin(): string {
  return useSyncExternalStore(noop, () => window.location.origin, () => "");
}

/** True when the browser can open the phone's share sheet. */
export function useCanShare(): boolean {
  return useSyncExternalStore(noop, () => "share" in navigator, () => false);
}
