"use client";

import { useState } from "react";
import { CopyIcon, buttonClass } from "@/components/ui";

/** Copies a link built from the current origin, such as "/patient". */
export function CopyLinkButton({ path, label }: { path: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  }
  return (
    <button type="button" onClick={copy} className={buttonClass({ variant: "secondary" })}>
      <CopyIcon size={20} />
      <span aria-live="polite">{copied ? "Link copiado" : label}</span>
    </button>
  );
}
