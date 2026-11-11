"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertIcon,
  Button,
  CameraIcon,
  Card,
  CheckIcon,
  ScreenHeader,
  StatusPill,
  buttonClass,
} from "@/components/ui";
import {
  confirmPrescription,
  getFamily,
  parsePrescription,
  type ReadItem,
} from "@/lib/api";

interface Draft {
  key: number;
  name: string;
  strength: string;
  activeIngredient: string;
  times: string;
  posology: string;
  instructions: string | null;
  review: string | null;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function toDraft(item: ReadItem, key: number): Draft {
  return {
    key,
    name: item.medication_name,
    strength: item.strength.text,
    activeIngredient: item.active_ingredient ?? "",
    times: item.schedule.map((s) => s.time).join(", "),
    posology: item.frequency.text,
    instructions: item.instructions,
    review: item.needs_review ? (item.review_reason ?? "Confira os dados deste remédio.") : null,
  };
}

/** "8:00, 20h" -> ["08:00", "20:00"]; null when any time is invalid. */
function parseTimes(text: string): string[] | null {
  const parts = text.split(/[,;\s]+/).filter(Boolean);
  const out: string[] = [];
  for (const raw of parts) {
    const m = /^(\d{1,2})(?:[:h](\d{2})?)?h?$/i.exec(raw);
    if (!m) return null;
    const t = `${m[1].padStart(2, "0")}:${m[2] ?? "00"}`;
    if (!TIME.test(t)) return null;
    out.push(t);
  }
  return [...new Set(out)].sort();
}

const inputClass =
  "w-full rounded-xl border-2 border-line bg-surface px-3 py-2.5 text-[17px] focus:border-brand focus:outline-none";

export function PrescriptionReview() {
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<"pick" | "reading" | "review" | "saving" | "done">("pick");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function read() {
    if (!file) return;
    setStep("reading");
    setError(null);
    try {
      const { reading } = await parsePrescription(file);
      if (!reading.is_prescription || reading.items.length === 0) {
        setError("Não encontramos remédios nessa foto. Tente uma foto mais nítida da receita.");
        setStep("pick");
        return;
      }
      setDrafts(reading.items.map(toDraft));
      setWarnings(reading.warnings);
      setStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não deu para ler a receita.");
      setStep("pick");
    }
  }

  function update(key: number, patch: Partial<Draft>) {
    setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  const invalid = drafts.filter((d) => !d.name.trim() || parseTimes(d.times) === null);

  async function save() {
    setStep("saving");
    setError(null);
    try {
      const { patient } = await getFamily();
      await confirmPrescription(
        patient.id,
        drafts.map((d) => ({
          name: d.name.trim(),
          activeIngredient: d.activeIngredient.trim() || null,
          strength: d.strength.trim() || null,
          times: parseTimes(d.times) ?? [],
        })),
      );
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não deu para salvar.");
      setStep("review");
    }
  }

  if (step === "done") {
    return (
      <>
        <ScreenHeader audience="family" title="Receita salva" />
        <Card tone="brand" className="flex flex-col gap-2">
          <p className="flex items-center gap-2 font-bold text-brand">
            <CheckIcon size={22} />
            {drafts.length} {drafts.length === 1 ? "remédio salvo" : "remédios salvos"}
          </p>
          <p className="leading-snug">Os lembretes já estão agendados nos horários que você conferiu.</p>
        </Card>
        <Link href="/family" className={buttonClass()}>
          Ver doses de hoje
        </Link>
      </>
    );
  }

  if (step === "review" || step === "saving") {
    return (
      <>
        <ScreenHeader audience="family" eyebrow="Confira antes de salvar" title="Remédios da receita" />
        <p className="text-[15px] leading-snug text-muted">
          A leitura pode errar. Compare com a receita e corrija o que for preciso. Os horários viram lembretes.
        </p>
        {warnings.map((w) => (
          <Card key={w} tone="warn" className="flex gap-2 text-[15px] leading-snug">
            <AlertIcon size={20} className="mt-0.5 shrink-0 text-warn" />
            {w}
          </Card>
        ))}
        {drafts.map((d, i) => {
          const timesOk = parseTimes(d.times) !== null;
          return (
            <Card key={d.key} tone={d.review ? "warn" : "default"} className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[19px] font-bold">Remédio {i + 1}</h2>
                {d.review ? <StatusPill tone="warn">Conferir</StatusPill> : null}
              </div>
              {d.review ? <p className="text-[15px] leading-snug">{d.review}</p> : null}
              <label className="flex flex-col gap-1">
                <span className="text-[15px] font-semibold">Nome</span>
                <input className={inputClass} value={d.name} onChange={(e) => update(d.key, { name: e.target.value })} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[15px] font-semibold">Dose</span>
                  <input
                    className={inputClass}
                    value={d.strength}
                    placeholder="50 mg"
                    onChange={(e) => update(d.key, { strength: e.target.value })}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[15px] font-semibold">Horários</span>
                  <input
                    className={inputClass}
                    value={d.times}
                    placeholder="08:00, 20:00"
                    inputMode="numeric"
                    aria-invalid={!timesOk}
                    onChange={(e) => update(d.key, { times: e.target.value })}
                  />
                </label>
              </div>
              {!timesOk ? (
                <p className="text-[15px] font-semibold text-danger">Use horários como 08:00, 20:00.</p>
              ) : null}
              <label className="flex flex-col gap-1">
                <span className="text-[15px] font-semibold">Princípio ativo</span>
                <input
                  className={inputClass}
                  value={d.activeIngredient}
                  onChange={(e) => update(d.key, { activeIngredient: e.target.value })}
                />
              </label>
              <p className="text-[15px] text-muted">
                Na receita: {d.posology}
                {d.instructions && !d.posology.toLowerCase().includes(d.instructions.toLowerCase())
                  ? `. ${d.instructions}`
                  : ""}
              </p>
              {!d.times.trim() ? (
                <p className="text-[15px] text-muted">Sem horário: fica salvo, mas sem lembrete.</p>
              ) : null}
              <Button
                variant="danger-outline"
                onClick={() => setDrafts((ds) => ds.filter((x) => x.key !== d.key))}
              >
                Tirar da lista
              </Button>
            </Card>
          );
        })}
        {error ? <p className="font-semibold text-danger">{error}</p> : null}
        <Button onClick={save} disabled={step === "saving" || drafts.length === 0 || invalid.length > 0}>
          <CheckIcon size={22} />
          {step === "saving" ? "Salvando..." : "Salvar e agendar lembretes"}
        </Button>
        <Button variant="secondary" onClick={() => setStep("pick")} disabled={step === "saving"}>
          Ler outra foto
        </Button>
      </>
    );
  }

  return (
    <>
      <ScreenHeader audience="family" eyebrow="Nova receita" title="Foto da receita" />
      <p className="leading-snug text-muted">
        Tire uma foto da receita inteira, com boa luz. Você confere tudo antes de salvar.
      </p>
      <label className={buttonClass({ variant: "secondary" })}>
        <CameraIcon size={22} />
        {file ? "Trocar foto" : "Tirar ou escolher foto"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          capture="environment"
          className="sr-only"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>
      {file ? <p className="text-[15px] text-muted">Arquivo: {file.name}</p> : null}
      {error ? <p className="font-semibold text-danger">{error}</p> : null}
      <Button onClick={read} disabled={!file || step === "reading"}>
        {step === "reading" ? "Lendo a receita..." : "Ler receita"}
      </Button>
      {step === "reading" ? (
        <p className="text-[15px] text-muted" aria-live="polite">
          Isso leva uns segundos.
        </p>
      ) : null}
      <Link href="/family" className="text-center text-brand">
        Voltar
      </Link>
    </>
  );
}
