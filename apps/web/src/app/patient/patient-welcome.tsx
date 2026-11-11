"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  Button,
  Card,
  BellIcon,
  CheckIcon,
  HeartIcon,
  ShareIcon,
} from "@/components/ui";
import { track } from "@/lib/analytics";
import { callName, type FamilyOverview } from "@/lib/api";
import { enablePush, type PushState } from "@/lib/push";

const READY_KEY = "recuidado:patient-ready";
const listeners = new Set<() => void>();

function readReady(): boolean {
  try {
    return window.localStorage.getItem(READY_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribeReady(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** True once this phone went through the first-access steps. Null while unknown (server render). */
export function usePatientReady(): boolean | null {
  return useSyncExternalStore(subscribeReady, readReady, () => null);
}

function markReady() {
  try {
    window.localStorage.setItem(READY_KEY, "1");
  } catch {
    // Private mode: the steps show again next time, which is fine.
  }
  listeners.forEach((l) => l());
}

type Platform = "installed" | "ios" | "other";

function readPlatform(): Platform {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "installed";
  return /iPhone|iPad|iPod/.test(navigator.userAgent) ? "ios" : "other";
}

const noSubscribe = () => () => {};

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Step = "hello" | "install" | "notify" | "done";

function Dots({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-[22px] text-muted">Passo {step} de 4</p>
      <div className="flex gap-1.5" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`h-2.5 rounded-full ${i === step ? "w-7" : "w-2.5"} ${i <= step ? "bg-brand" : "bg-line"}`}
          />
        ))}
      </div>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="flex size-36 items-center justify-center rounded-full bg-brand-soft">
      <span className="flex size-28 items-center justify-center rounded-full bg-brand text-white">
        {children}
      </span>
    </span>
  );
}

function times(data: FamilyOverview): string[] {
  return [...new Set(data.medications.flatMap((m) => m.times))].sort().map((t) => t.replace(/^0(\d)/, "$1"));
}

function joinTimes(list: string[]): string {
  return list.length > 1
    ? `${list.slice(0, -1).join(", ")} e ${list.at(-1)}`
    : (list[0] ?? "");
}

/** First access on Dona Maria's phone: hello, add to home screen, allow reminders, ready. */
export function PatientWelcome({ data }: { data: FamilyOverview }) {
  const platform = useSyncExternalStore(
    noSubscribe,
    readPlatform,
    () => "other" as Platform,
  );
  const [step, setStep] = useState<Step>("hello");
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(
    null,
  );
  const [push, setPush] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const name = callName(data.patient);
  const family = data.caregivers.map((c) => c.name.trim().split(/\s+/)[0]);
  const host = family[0] ?? "Sua família";
  const hours = times(data);

  function go(next: Step) {
    track("patient_welcome_step", { step: next });
    setStep(next);
  }

  async function install() {
    if (!installEvent) return go("notify");
    await installEvent.prompt();
    await installEvent.userChoice.catch(() => null);
    setInstallEvent(null);
    go("notify");
  }

  async function allow() {
    setBusy(true);
    try {
      const state = await enablePush(data.patient.id).catch(
        () => "unsupported" as PushState,
      );
      setPush(state);
      if (state === "on") go("done");
    } finally {
      setBusy(false);
    }
  }

  if (step === "hello") {
    return (
      <div className="flex flex-1 flex-col gap-6">
        <Dots step={1} />
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
          <Badge>
            <HeartIcon size={60} strokeWidth={2.2} />
          </Badge>
          <h1 className="text-[42px] font-bold leading-tight">Oi, {name}!</h1>
          <p className="text-[26px] leading-snug">
            {host} preparou o Recuidado para você.
          </p>
          <p className="text-[24px] leading-snug text-muted">
            Ele avisa na hora do remédio. Você só toca em{" "}
            <b className="text-ink">Tomei</b>.
          </p>
        </div>
        <Button
          size="xl"
          onClick={() => go(platform === "installed" ? "notify" : "install")}
        >
          Começar
        </Button>
      </div>
    );
  }

  if (step === "install") {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <Dots step={2} />
        <h1 className="text-[34px] font-bold leading-tight">
          Coloque o Recuidado na tela do celular
        </h1>
        <p className="text-[22px] text-muted">Assim você abre com um toque.</p>
        {platform === "ios" ? (
          <Card className="px-4 py-5">
            <ol className="flex flex-col gap-3.5">
              <InstallStep n={1}>
                Toque em{" "}
                <ShareIcon
                  size={24}
                  className="inline align-[-4px]"
                  aria-hidden={false}
                  role="img"
                  aria-label="Compartilhar"
                />{" "}
                <b>Compartilhar</b>, embaixo da tela.
              </InstallStep>
              <InstallStep n={2}>
                Toque em <b>Adicionar à Tela de Início</b>.
              </InstallStep>
              <InstallStep n={3}>
                Toque em <b>Adicionar</b>.
              </InstallStep>
            </ol>
          </Card>
        ) : installEvent ? (
          <p className="text-[24px] leading-snug">
            Toque em <b>Colocar na tela</b> e depois em <b>Instalar</b>.
          </p>
        ) : (
          <Card className="px-4 py-5">
            <ol className="flex flex-col gap-3.5">
              <InstallStep n={1}>
                Toque nos <b>três pontinhos</b>, em cima da tela.
              </InstallStep>
              <InstallStep n={2}>
                Toque em <b>Adicionar à tela inicial</b> ou <b>Instalar</b>.
              </InstallStep>
            </ol>
          </Card>
        )}
        <div className="mt-auto flex flex-col gap-3">
          {installEvent ? (
            <Button size="xl" onClick={install}>
              Colocar na tela
            </Button>
          ) : (
            <Button size="xl" onClick={() => go("notify")}>
              Já coloquei
            </Button>
          )}
          <Button variant="secondary" size="lg" onClick={() => go("notify")}>
            Fazer depois
          </Button>
        </div>
      </div>
    );
  }

  if (step === "notify") {
    const blocked = push !== null && push !== "on";
    return (
      <div className="flex flex-1 flex-col gap-6">
        <Dots step={3} />
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
          <Badge>
            <BellIcon size={60} strokeWidth={2.2} />
          </Badge>
          <h1 className="text-[38px] font-bold leading-tight">
            Posso avisar na hora do remédio?
          </h1>
          {hours.length > 0 ? (
            <p className="text-[24px] leading-snug">
              O celular vai tocar às {joinTimes(hours)}.
            </p>
          ) : null}
          {blocked ? (
            <Card
              className="px-4 py-4 text-left text-[22px] leading-snug"
              role="status"
            >
              {push === "denied"
                ? "O celular bloqueou os avisos. Peça ajuda para liberar nas configurações."
                : push === "unsupported"
                  ? "Este celular não recebe avisos por aqui."
                  : "Os avisos ainda não foram ligados."}{" "}
              Se você não tocar em Tomei, o Recuidado liga para você.
            </Card>
          ) : (
            <Card className="px-4 py-4 text-left text-[22px] leading-snug">
              Quando o celular perguntar, toque em <b>Permitir</b>.
            </Card>
          )}
        </div>
        {blocked ? (
          <Button size="xl" onClick={() => go("done")}>
            Continuar
          </Button>
        ) : (
          <Button size="xl" onClick={allow} disabled={busy}>
            {busy ? "Só um instante..." : "Sim, pode avisar"}
          </Button>
        )}
        {blocked ? null : (
          <p className="text-center text-[22px] leading-snug text-muted">
            Se não der, {host} recebe o aviso e o Recuidado liga para você.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <Dots step={4} />
      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <Badge>
          <CheckIcon size={66} strokeWidth={2.8} />
        </Badge>
        <h1 className="text-[42px] font-bold leading-tight">Pronto, {name}!</h1>
        <p className="text-[26px] leading-snug">
          Quando o celular tocar, abra e toque em <b>Tomei</b>.
        </p>
        {family.length > 0 ? (
          <p className="text-[24px] leading-snug text-muted">
            {family.join(" e ")}{" "}
            {family.length > 1 ? "ficam sabendo" : "fica sabendo"}.
          </p>
        ) : null}
      </div>
      <Button
        size="xl"
        onClick={() => {
          track("patient_welcome_done", { push: push ?? "skipped" });
          markReady();
        }}
      >
        Ver meus remédios
      </Button>
    </div>
  );
}

function InstallStep({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3.5">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-[24px] font-bold text-white">
        {n}
      </span>
      <span className="pt-1 text-[24px] leading-snug">{children}</span>
    </li>
  );
}
