"use client";

import { useCallback, useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import { Logo } from "@/components/ui";

type Kind = "reminder" | "recall" | "check_in" | "caregiver" | "pharmacy";

interface CallEvent {
  atMs: number;
  text: string;
}

interface CallLog {
  sessionId: string;
  kind: Kind | null;
  outcome: string | null;
  durationSeconds: number | null;
  startedAt: string;
  transcript: { speaker: string; text: string }[];
  events: CallEvent[];
  hasRecording: boolean;
}

const KIND: Record<Kind, { label: string; other: string }> = {
  reminder: { label: "Lembrete do remédio", other: "Dona Maria" },
  recall: { label: "Segunda ligação do remédio", other: "Dona Maria" },
  check_in: { label: "Ligação de volta depois da emergência", other: "Dona Maria" },
  caregiver: { label: "Recado para o primeiro contato", other: "Filho" },
  pharmacy: { label: "Pergunta à farmácia", other: "Farmácia" },
};

const OUTCOME: Record<string, string> = {
  confirmed: "Tomou",
  not_taken: "Não tomou",
  unclear: "Sem resposta clara",
  no_answer: "Não atendeu",
  failed: "Falhou",
  delivered: "Recado entregue",
  answered: "Atendeu",
  answered_partial: "Resposta parcial",
};

const time = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function clock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Lines that say what the system decided. The rest (sideband events) only show with "todos os passos". */
const KEY_STEP =
  /^(function |required line|dose answer|answer recorded|answer not recorded|pharmacy answer|goodbye|no goodbye|recording|voice gate|pressing keys|dtmf sent|menu |no menu|decision:|other side|person on the line|the person is back|voicemail|closed |alert |playing recorded|max call|nobody spoke|event (transport\.answered|transport\.failed|session\.closed))/i;

function isKeyStep(text: string): boolean {
  return KEY_STEP.test(text);
}

function Timeline({ events }: { events: CallEvent[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? events : events.filter((e) => isKeyStep(e.text));
  if (events.length === 0) return <p className="text-[14px] text-muted">Sem passos registrados.</p>;
  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-1 font-mono text-[12.5px] leading-snug">
        {shown.map((e, i) => (
          <li key={i} className="flex gap-2">
            <span className="w-11 shrink-0 tabular-nums text-muted">{clock(e.atMs)}</span>
            <span className={`min-w-0 break-words [overflow-wrap:anywhere] ${e.text.startsWith("function ") || e.text.startsWith("required line") ? "font-semibold text-brand" : ""}`}>
              {e.text}
            </span>
          </li>
        ))}
      </ol>
      <button type="button" onClick={() => setAll((v) => !v)} className="self-start text-[13px] font-bold text-brand underline">
        {all ? "Só os passos principais" : `Todos os passos (${events.length})`}
      </button>
    </div>
  );
}

function CallCard({ call }: { call: CallLog }) {
  const kind = call.kind ? KIND[call.kind] : { label: "Ligação", other: "Outro lado" };
  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-ink/10 bg-white p-4 shadow-sm sm:p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[18px] font-semibold">{kind.label}</h2>
        <span className="text-[14px] text-muted">
          {time.format(new Date(call.startedAt))}
          {call.durationSeconds != null ? ` · ${clock(call.durationSeconds * 1000)}` : ""}
          {call.outcome ? ` · ${OUTCOME[call.outcome] ?? call.outcome}` : ""}
        </span>
      </header>
      {call.hasRecording ? (
        <audio controls preload="none" className="w-full" src={`${API_URL}/call-logs/${encodeURIComponent(call.sessionId)}/recording`} />
      ) : (
        <p className="text-[14px] text-muted">Sem gravação desta ligação.</p>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-2">
          <h3 className="text-[13px] font-bold uppercase tracking-wide text-muted">Conversa</h3>
          {call.transcript.length === 0 ? (
            <p className="text-[14px] text-muted">Sem transcrição.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {call.transcript.map((l, i) => {
                const ai = l.speaker === "assistant";
                return (
                  <li key={i} className={`flex flex-col ${ai ? "items-start" : "items-end"}`}>
                    <span className="text-[12px] font-bold text-muted">{ai ? "Assistente da Recuidado" : kind.other}</span>
                    <span
                      className={`max-w-[92%] rounded-2xl px-3 py-2 text-[15px] leading-snug ${ai ? "bg-[#efe9df]" : "bg-brand text-white"}`}
                    >
                      {l.text}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="flex min-w-0 flex-col gap-2">
          <h3 className="text-[13px] font-bold uppercase tracking-wide text-muted">O que o sistema fez</h3>
          <Timeline events={call.events} />
        </section>
      </div>
    </article>
  );
}

export function CallsView() {
  const [calls, setCalls] = useState<CallLog[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/call-logs?limit=40`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setCalls((await res.json()) as CallLog[]);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const timer = setInterval(() => void load(), 15_000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <main className="min-h-dvh bg-[#efe9df] px-4 pb-10 pt-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <header className="flex flex-col gap-2">
          <Logo size={26} variant="full" />
          <h1 className="font-display text-[32px] leading-[1.08]">Ligações da prova de conceito</h1>
          <p className="max-w-2xl text-[16px] text-muted">
            Cada ligação que a assistente fez para a família de demonstração: o áudio gravado, o que cada lado disse e o que o
            sistema fez em cada momento (registro da resposta, frase garantida pelo código, teclas na farmácia). Dados de teste;
            as vozes são da equipe.
          </p>
        </header>
        {error && <p className="text-[15px] font-bold text-red-700">Não foi possível carregar as ligações agora.</p>}
        {calls === null && !error && <p className="text-[15px] text-muted">Carregando…</p>}
        {calls?.length === 0 && <p className="text-[15px] text-muted">Nenhuma ligação registrada ainda.</p>}
        {calls?.map((c) => <CallCard key={c.sessionId} call={c} />)}
      </div>
    </main>
  );
}
