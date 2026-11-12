"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Button, Card, Sheet, ShareIcon, buttonClass } from "@/components/ui";

export type Platform = "installed" | "ios" | "other";

/** Installed (opened from the home screen), iPhone, or anything else (Android and the panel's phones). */
export function readPlatform(): Platform {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "installed";
  return /iPhone|iPad|iPod/.test(navigator.userAgent) ? "ios" : "other";
}

const noSubscribe = () => () => {};

export function usePlatform(): Platform {
  return useSyncExternalStore(noSubscribe, readPlatform, () => "installed" as Platform);
}

export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Chrome's own "install" prompt, when the browser offers it. */
export function useInstallPrompt() {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null);
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);
  async function prompt() {
    if (!event) return;
    await event.prompt();
    await event.userChoice.catch(() => null);
    setEvent(null);
  }
  return { canPrompt: event !== null, prompt };
}

function InstallStep({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3.5">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blush font-display text-[24px] text-accent-ink">
        {n}
      </span>
      <span className="pt-1 text-[24px] leading-snug">{children}</span>
    </li>
  );
}

/** Steps to put the Recuidado on the home screen, for iPhone or for Android. */
export function InstallSteps({ platform, card = true }: { platform: Platform; card?: boolean }) {
  const steps =
    platform === "ios" ? (
      <ol className="flex flex-col gap-3.5">
        <InstallStep n={1}>
          Toque em{" "}
          <ShareIcon size={24} className="inline align-[-4px]" aria-hidden={false} role="img" aria-label="Compartilhar" />{" "}
          <b>Compartilhar</b>, embaixo da tela.
        </InstallStep>
        <InstallStep n={2}>
          Toque em <b>Adicionar à Tela de Início</b>.
        </InstallStep>
        <InstallStep n={3}>
          Toque em <b>Adicionar</b>.
        </InstallStep>
      </ol>
    ) : (
      <ol className="flex flex-col gap-3.5">
        <InstallStep n={1}>
          Toque nos <b>três pontinhos</b>, em cima da tela.
        </InstallStep>
        <InstallStep n={2}>
          Toque em <b>Adicionar à tela inicial</b> ou <b>Instalar</b>.
        </InstallStep>
        <InstallStep n={3}>
          Toque em <b>Adicionar</b>.
        </InstallStep>
      </ol>
    );
  return card ? (
    <Card className="px-5 py-5 shadow-[0_12px_28px_-16px_rgba(22,19,20,0.35)]">{steps}</Card>
  ) : (
    steps
  );
}

/** Home screen button, only while the app is open in the browser: puts it on the phone's home screen. */
export function InstallAppButton({ className }: { className?: string }) {
  const platform = usePlatform();
  const { canPrompt, prompt } = useInstallPrompt();
  const [open, setOpen] = useState(false);
  if (platform === "installed") return null;
  return (
    <>
      <button
        type="button"
        onClick={() => (canPrompt ? prompt() : setOpen(true))}
        className={buttonClass({ variant: "secondary", size: "lg", className })}
      >
        <HomeScreenIcon />
        Pôr na tela do celular
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Pôr na tela do celular">
        <p className="text-[22px] leading-snug text-muted">Assim você abre o Recuidado com um toque, como um aplicativo.</p>
        <InstallSteps platform={platform} card={false} />
        <Button size="lg" onClick={() => setOpen(false)}>
          Entendi
        </Button>
      </Sheet>
    </>
  );
}

function HomeScreenIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <path d="M12 8v6M9 11h6" />
    </svg>
  );
}
