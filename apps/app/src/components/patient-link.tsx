"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { CopyIcon } from "@/components/ui";
import { getPatientLink } from "@/lib/api";
import { useOrigin } from "@/lib/origin";
import { useSignedIn } from "@/lib/session";

const SEEN_KEY = "recuidado:patient-link-seen";

/** True once the family has opened the screen that sets up Dona Maria's phone. */
export function patientLinkSeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

export function markPatientLinkSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Private mode: the step may show again, which is fine.
  }
}

/** Where to go after medications are saved: her phone setup the first time, otherwise `fallback`. */
export function afterMedsHref(fallback: string): string {
  return patientLinkSeen() ? fallback : "/family/celular";
}

/**
 * The link that opens her app: /m/<secret>. She never signs up; this link is her login. Visitors
 * (demo family) get /patient, which shows Dona Maria.
 */
export function usePatientUrl(): { url: string; renew: () => Promise<void> } {
  const origin = useOrigin();
  const signedIn = useSignedIn();
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    if (!signedIn) return;
    getPatientLink().then(setToken, () => {});
  }, [signedIn]);
  const url = !origin ? "" : signedIn ? (token ? `${origin}/m/${token}` : "") : `${origin}/patient`;
  return { url, renew: async () => setToken(await getPatientLink(true)) };
}

/** QR code and copy button with the link to the patient app. */
export function PatientLink() {
  const { url } = usePatientUrl();
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {}
  }
  return (
    <section className="flex items-stretch gap-4 rounded-card border border-line-soft bg-surface p-4">
      <span className="flex size-[132px] shrink-0 items-center justify-center rounded-xl border border-line bg-white p-2">
        {url ? (
          <QRCodeSVG value={url} size={114} fgColor="#161314" title="QR code do app dela" />
        ) : null}
      </span>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2.5">
        <p className="text-[16px] leading-snug">Aponte a câmera do celular dela para o código.</p>
        <button
          type="button"
          onClick={copy}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border-[1.5px] border-ink bg-surface text-[16px] font-bold"
        >
          <CopyIcon size={18} />
          <span aria-live="polite">{copied ? "Copiado" : "Copiar link"}</span>
        </button>
      </div>
    </section>
  );
}
