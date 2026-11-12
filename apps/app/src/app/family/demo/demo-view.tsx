"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { EnableNotifications } from "@/components/enable-notifications";
import { PageTitle } from "@/components/page-title";
import {
  BellIcon,
  Button,
  Card,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  PhoneIcon,
  StatusPill,
  UsersIcon,
  buttonClass,
  type StatusTone,
} from "@/components/ui";
import { captureError, track } from "@/lib/analytics";
import { callName, getDemoRun, startDemoRun, type DemoRun, type DemoStep } from "@/lib/api";
import { readDemoRun, saveDemoRun } from "@/lib/demo";
import { useMe } from "@/lib/me";
import { useFamily } from "@/lib/use-family";
import { pronouns } from "@/lib/pronouns";

const PILL: Record<DemoStep["state"], { tone: StatusTone; text: string }> = {
  waiting: { tone: "neutral", text: "Aguardando" },
  active: { tone: "warn", text: "Agora" },
  done: { tone: "ok", text: "Feito" },
  skipped: { tone: "neutral", text: "Não precisou" },
  failed: { tone: "danger", text: "Falhou" },
};

function countdown(at: string | null, now: number): string | null {
  if (!at) return null;
  const s = Math.max(0, Math.round((new Date(at).getTime() - now) / 1000));
  return s > 0 ? `em ${s} s` : null;
}

function StepRow({
  icon,
  title,
  step,
  now,
}: {
  icon: ReactNode;
  title: string;
  step: DemoStep | null;
  now: number;
}) {
  const pill = step ? PILL[step.state] : PILL.waiting;
  const left = step?.state === "waiting" ? countdown(step.at, now) : null;
  return (
    <li className="flex items-start gap-3 border-b border-line-soft p-4 last:border-b-0">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blush text-accent-ink">
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <b>{title}</b>
        {step?.detail ? <span className="text-[15px] leading-snug text-muted">{step.detail}</span> : null}
      </span>
      <StatusPill tone={pill.tone}>{left ?? pill.text}</StatusPill>
    </li>
  );
}

export function DemoView() {
  const { data } = useFamily();
  const [me] = useMe();
  const [doseId, setDoseId] = useState<string | null>(null);
  const [run, setRun] = useState<DemoRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  // undefined until the first tick has looked for a run started a moment ago (page reload while recording).
  const following = useRef<string | null | undefined>(undefined);

  // One loop: clock every second, run status every 2 seconds while a run is going.
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let lastPoll = 0;
    const tick = async () => {
      setNow(Date.now());
      if (following.current === undefined) {
        const saved = readDemoRun();
        following.current = saved && Date.now() - saved.startedAt < 4 * 60 * 1000 ? saved.doseId : null;
        setDoseId(following.current);
      }
      const id = following.current;
      if (id && Date.now() - lastPoll >= 2_000) {
        lastPoll = Date.now();
        try {
          const r = await getDemoRun(id);
          if (!stopped && following.current === id) {
            setRun(r);
            // Nothing else will happen: stop polling and keep the result on screen.
            if (r.finished) {
              following.current = null;
              setDoseId(null);
            }
          }
        } catch (e) {
          captureError(e, { screen: "demo" });
        }
      }
      if (!stopped) timer = setTimeout(tick, 1_000);
    };
    timer = setTimeout(tick, 0);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const r = await startDemoRun();
      saveDemoRun(r.doseId);
      following.current = r.doseId;
      setRun(null);
      setDoseId(r.doseId);
      track("demo_run_clicked", { already_running: r.alreadyRunning });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não deu para começar a demo.");
      captureError(e, { screen: "demo" });
    } finally {
      setBusy(false);
    }
  }

  const name = data ? callName(data.patient) : "Dona Maria";
  const pr = pronouns(data?.patient.gender);
  const running = doseId !== null;
  const hasPhone = data?.patient.hasPhone ?? (data?.patient.phone?.replace(/\D/g, "").length ?? 0) >= 10;

  return (
    <>
      <PageTitle
        title="Demo em 2 minutos"
        subtitle={`O dia de ${name} acelerado: o que acontece quando ${pr.ela} não confirma o remédio.`}
      />

      <Card className="flex flex-col gap-2 text-[16px] leading-snug">
        <p>
          Cria uma dose de agora e segue o caminho de verdade: lembrete no celular {pr.dela}, ligação da IA e aviso para a
          família. A espera, que no dia a dia é de minutos, aqui é de segundos.
        </p>
        <p className="text-muted">A agenda normal dos remédios continua igual.</p>
      </Card>

      {data?.calls === false ? (
        <p className="rounded-card bg-warn-soft p-4 text-[15px] text-warn">
          A ligação é do plano pago, que chega em breve. A demo mostra o lembrete e o aviso para a família.
        </p>
      ) : !hasPhone && data ? (
        <p className="rounded-card bg-warn-soft p-4 text-[15px] text-warn">
          {name} está sem telefone no cadastro, então a ligação vai ser pulada.
        </p>
      ) : null}

      <ul className="overflow-hidden rounded-card bg-surface">
        <StepRow icon={<BellIcon size={22} />} title={`Lembrete para ${name}`} step={run?.reminder ?? null} now={now} />
        <StepRow icon={<PhoneIcon size={22} />} title="Ligação da IA" step={run?.call ?? null} now={now} />
        <StepRow icon={<UsersIcon size={22} />} title="Família avisada" step={run?.family ?? null} now={now} />
      </ul>

      {run?.finished ? (
        <p className="flex items-center gap-2 font-semibold text-brand">
          <CheckIcon size={22} />
          {run.status === "taken" ? `${name} tomou o remédio.` : `A família já sabe e pode ligar para ${pr.ela}.`}
        </p>
      ) : null}

      {run && run.transcript.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-[18px] font-semibold">O que foi dito na ligação</h2>
          <Card className="flex flex-col gap-2 text-[15px] leading-snug">
            {run.transcript.map((t, i) => (
              <p key={i}>
                <b>{t.speaker === "assistant" ? "Recuidado" : name}:</b> {t.text}
              </p>
            ))}
          </Card>
        </section>
      ) : null}

      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}

      <Button onClick={start} disabled={busy || running}>
        <ClockIcon size={22} />
        {running ? "Demo em andamento" : run?.finished ? "Rodar de novo" : "Começar a demo"}
      </Button>

      <Link href="/patient" className={buttonClass({ variant: "secondary" })}>
        Abrir o app de {name}
        <ChevronRightIcon size={20} />
      </Link>
      <Link href="/family" className={buttonClass({ variant: "secondary" })}>
        Ver o painel de hoje
        <ChevronRightIcon size={20} />
      </Link>

      {me ? (
        <EnableNotifications memberId={me} label="Receber o aviso neste celular" />
      ) : (
        <p className="text-[15px] text-muted">
          Para receber o aviso da família neste celular, escolha quem você é na aba{" "}
          <Link href="/family/familia">Família</Link>.
        </p>
      )}
    </>
  );
}
