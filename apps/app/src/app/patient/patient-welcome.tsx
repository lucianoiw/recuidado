"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
} from "@/components/ui";
import { InstallSteps, readPlatform, type InstallPromptEvent, type Platform } from "@/components/install-app";
import { track } from "@/lib/analytics";
import { callName, setConsent, type FamilyOverview } from "@/lib/api";
import { enablePush, type PushState } from "@/lib/push";
import { useScrollTopOn } from "@/lib/scroll-top";

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

type Step = "hello" | "consent" | "install" | "notify" | "done";

function Dots({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-[22px] text-muted">Passo {step} de 5</p>
      <div className="flex gap-1.5" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={`h-2.5 rounded-full ${i === step ? "w-7" : "w-2.5"} ${i <= step ? "bg-accent" : "bg-line"}`}
          />
        ))}
      </div>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="flex size-32 items-center justify-center rounded-full bg-blush text-accent">{children}</span>
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

/** First access on Dona Maria's phone: hello, her consent (LGPD), add to home screen, allow reminders, ready. */
export function PatientWelcome({ data }: { data: FamilyOverview }) {
  const platform = useSyncExternalStore(
    () => () => {},
    readPlatform,
    () => "other" as Platform,
  );
  const [step, setStep] = useState<Step>("hello");
  useScrollTopOn(step);
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(
    null,
  );
  const [push, setPush] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const router = useRouter();

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

  const afterConsent: Step = platform === "installed" ? "notify" : "install";

  async function answer(accepted: boolean) {
    setBusy(true);
    setConsentError(false);
    try {
      await setConsent(data.patient.id, accepted);
      track(accepted ? "patient_consent_given" : "patient_consent_declined");
      if (accepted) go(afterConsent);
      else setDeclined(true);
    } catch {
      setConsentError(true);
    } finally {
      setBusy(false);
    }
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
            <HeartIcon size={56} strokeWidth={1.8} />
          </Badge>
          <h1 className="font-display text-[44px] leading-[1.02]">Oi, {name}!</h1>
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
          className="font-display"
          // She already said yes in this app: no need to ask again.
          onClick={() => go(data.patient.consentSource === "patient" ? afterConsent : "consent")}
        >
          Começar
        </Button>
      </div>
    );
  }

  if (step === "consent") {
    return (
      <div className="flex flex-1 flex-col gap-5">
        <Dots step={2} />
        <h1 className="font-display text-[40px] leading-[1.04]">Combinado, {name}?</h1>
        {declined ? (
          <Card className="shadow-[0_12px_28px_-16px_rgba(22,19,20,0.35)] px-5 py-5 text-[24px] leading-snug" role="status">
            Tudo bem. O Recuidado não vai avisar nem ligar. Se mudar de ideia, toque em <b>Aceito</b>.
          </Card>
        ) : (
          <Card className="shadow-[0_12px_28px_-16px_rgba(22,19,20,0.35)] px-5 py-5">
            <ul className="flex flex-col gap-3.5 text-[24px] leading-snug">
              <li>O celular avisa na hora do remédio.</li>
              <li>
                Se você não tocar em <b>Tomei</b>, uma assistente virtual liga. Não é uma pessoa.
              </li>
              <li>{host} {family.length > 1 ? "e a família ficam" : "fica"} sabendo se você tomou.</li>
            </ul>
          </Card>
        )}
        {consentError ? (
          <p className="text-[22px] font-semibold text-danger" role="alert">
            Não deu para salvar. Tente de novo.
          </p>
        ) : null}
        <div className="mt-auto flex flex-col gap-3">
          <Button size="xl" className="font-display" onClick={() => answer(true)} disabled={busy}>
            {busy ? "Só um instante..." : "Aceito"}
          </Button>
          {declined ? null : (
            <Button variant="secondary" size="lg" onClick={() => answer(false)} disabled={busy}>
              Não quero
            </Button>
          )}
          <Link href="/privacidade" className="py-2 text-center text-[22px] font-semibold text-ink underline underline-offset-4">
            Como cuidamos dos seus dados
          </Link>
        </div>
      </div>
    );
  }

  if (step === "install") {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <Dots step={3} />
        <h1 className="font-display text-[36px] leading-[1.06]">
          Coloque o Recuidado na tela do celular
        </h1>
        <p className="text-[22px] text-muted">Assim você abre com um toque.</p>
        {installEvent ? (
          <p className="text-[24px] leading-snug">
            Toque em <b>Colocar na tela</b> e depois em <b>Instalar</b>.
          </p>
        ) : (
          <InstallSteps platform={platform} />
        )}
        <div className="mt-auto flex flex-col gap-3">
          {installEvent ? (
            <Button size="xl" className="font-display" onClick={install}>
              Colocar na tela
            </Button>
          ) : (
            <Button size="xl" className="font-display" onClick={() => go("notify")}>
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
        <Dots step={4} />
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
          <Badge>
            <BellIcon size={56} strokeWidth={1.8} />
          </Badge>
          <h1 className="font-display text-[40px] leading-[1.04]">
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
              {data.calls === false
                ? `Se você não tocar em Tomei, ${host} recebe o aviso.`
                : "Se você não tocar em Tomei, o Recuidado liga para você."}
            </Card>
          ) : (
            <Card className="shadow-[0_12px_28px_-16px_rgba(22,19,20,0.35)] px-5 py-4 text-left text-[22px] leading-snug">
              Quando o celular perguntar, toque em <b>Permitir</b>.
            </Card>
          )}
        </div>
        {blocked ? (
          <Button size="xl" className="font-display" onClick={() => go("done")}>
            Continuar
          </Button>
        ) : (
          <Button size="xl" className="font-display" onClick={allow} disabled={busy}>
            {busy ? "Só um instante..." : "Sim, pode avisar"}
          </Button>
        )}
        {blocked ? null : (
          <p className="text-center text-[22px] leading-snug text-muted">
            {data.calls === false
              ? `Se não der, ${host} recebe o aviso.`
              : `Se não der, ${host} recebe o aviso e o Recuidado liga para você.`}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <Dots step={5} />
      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <Badge>
          <CheckIcon size={60} strokeWidth={2.2} />
        </Badge>
        <h1 className="font-display text-[44px] leading-[1.02]">Pronto, {name}!</h1>
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
        className="font-display"
        onClick={() => {
          track("patient_welcome_done", { push: push ?? "skipped" });
          markReady();
          router.push("/patient/remedios");
        }}
      >
        Ver meus remédios
      </Button>
    </div>
  );
}

