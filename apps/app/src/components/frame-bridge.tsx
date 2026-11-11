"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { setPatientLink, setSession } from "@/lib/session";
import { clearMe } from "@/lib/me";

/** Origins allowed to frame the app and talk to it: the two phones page. */
function isPanel(origin: string): boolean {
  try {
    const { hostname, protocol } = new URL(origin);
    return (protocol === "https:" && hostname === "painel.recuidado.com.br") || hostname === "localhost";
  } catch {
    return false;
  }
}

/**
 * Inside the two phones page (painel), each phone is this app in a frame. The frame tells the page
 * its address (for the fake address bar) and obeys "start over", which forgets both logins.
 */
export function FrameBridge() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.parent === window) return;
    window.parent.postMessage({ type: "recuidado:location", href: window.location.href }, "*");
  }, [pathname]);

  useEffect(() => {
    if (window.parent === window) return;
    function onMessage(e: MessageEvent) {
      if (e.source !== window.parent || !isPanel(e.origin)) return;
      if ((e.data as { type?: string } | null)?.type !== "recuidado:reset") return;
      setSession(null);
      setPatientLink(null);
      clearMe();
      try {
        localStorage.removeItem("recuidado:patient-ready");
      } catch {}
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return null;
}
