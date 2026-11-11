"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertIcon,
  Button,
  CameraIcon,
  CartIcon,
  CheckIcon,
  ChevronRightIcon,
  GiftIcon,
  PencilIcon,
  PlusIcon,
  StatusPill,
  TopBar,
  XIcon,
  buttonClass,
  cn,
  inputClass,
} from "@/components/ui";
import {
  confirmPrescription,
  getFamily,
  parsePrescription,
  type FamilyOverview,
  type ReadItem,
} from "@/lib/api";
import { brl, medLabel } from "@/lib/use-family";

interface Draft {
  key: number;
  name: string;
  strength: string;
  activeIngredient: string;
  times: string[];
  posology: string;
  instructions: string | null;
  review: string | null;
  editing: boolean;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function normalizeTime(raw: string): string | null {
  const m = /^(\d{1,2})(?:[:h](\d{2})?)?h?$/i.exec(raw.trim());
  if (!m) return null;
  const t = `${m[1].padStart(2, "0")}:${m[2] ?? "00"}`;
  return TIME.test(t) ? t : null;
}

function toDraft(item: ReadItem, key: number): Draft {
  const times = item.schedule
    .map((s) => normalizeTime(s.time))
    .filter((t): t is string => t !== null);
  return {
    key,
    name: item.medication_name,
    strength: item.strength.text,
    activeIngredient: item.active_ingredient ?? "",
    times: [...new Set(times)].sort(),
    posology: item.frequency.text,
    instructions: item.instructions,
    review: item.needs_review ? (item.review_reason ?? "Confira os dados deste remédio.") : null,
    editing: item.needs_review,
  };
}

const READING_STEPS = [
  "Lendo os remédios",
  "Montando os horários",
  "Procurando no Farmácia Popular",
  "Separando o que precisa comprar",
];

function ReadingSteps() {
  const [done, setDone] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setDone((n) => Math.min(n + 1, READING_STEPS.length - 1)), 3500);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-8 text-center">
      <span className="relative flex size-28 items-center justify-center rounded-full bg-brand-soft text-brand">
        <span className="absolute inset-0 animate-ping rounded-full bg-brand-soft motion-reduce:animate-none" />
        <CameraIcon size={48} className="relative" />
      </span>
      <div className="flex flex-col gap-1" aria-live="polite">
        <h1 className="text-[26px] font-extrabold">Lendo a receita...</h1>
        <p className="text-muted">Leva uns 15 segundos.</p>
      </div>
      <ul className="flex w-full flex-col gap-3 rounded-card border border-line-soft bg-surface p-4 text-left">
        {READING_STEPS.map((s, i) => (
          <li key={s} className={cn("flex items-center gap-3", i > done && "text-muted")}>
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full",
                i < done ? "bg-brand text-white" : i === done ? "border-2 border-brand" : "border-2 border-line",
              )}
            >
              {i < done ? <CheckIcon size={16} strokeWidth={3} /> : null}
            </span>
            <span className={cn(i === done && "font-bold")}>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TimeChips({
  times,
  onChange,
}: {
  times: string[];
  onChange: (times: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");

  function add() {
    const t = normalizeTime(value);
    if (t) onChange([...new Set([...times, t])].sort());
    setValue("");
    setAdding(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {times.map((t) => (
        <span
          key={t}
          className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-brand-soft pl-3.5 pr-1 text-[17px] font-bold text-brand"
        >
          {t}
          <button
            type="button"
            onClick={() => onChange(times.filter((x) => x !== t))}
            className="flex size-9 items-center justify-center rounded-lg hover:bg-white/60"
          >
            <XIcon size={16} />
            <span className="sr-only">Tirar {t}</span>
          </button>
        </span>
      ))}
      {adding ? (
        <span className="inline-flex items-center gap-2">
          <input
            type="time"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            aria-label="Novo horário"
            className={cn(inputClass, "h-11 w-32")}
          />
          <button
            type="button"
            onClick={add}
            className="min-h-11 rounded-xl bg-brand px-3.5 text-[16px] font-bold text-white"
          >
            Pôr
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-[#cfc8ba] px-3.5 text-[16px] font-bold text-muted"
        >
          <PlusIcon size={16} />
          horário
        </button>
      )}
    </div>
  );
}

function Result({ family, count }: { family: FamilyOverview | null; count: number }) {
  const meds = family?.medications ?? [];
  const free = meds.filter((m) => m.freeInFarmaciaPopular);
  const paid = meds.filter((m) => !m.freeInFarmaciaPopular);
  return (
    <>
      <div className="flex flex-col items-center gap-3 pt-4 text-center">
        <span className="flex size-20 items-center justify-center rounded-full bg-brand text-white">
          <CheckIcon size={44} strokeWidth={2.8} />
        </span>
        <h1 className="text-[26px] font-extrabold leading-tight">
          Receita salva.
          <br />
          Lembretes ligados.
        </h1>
        <p className="text-muted">
          {count} {count === 1 ? "remédio conferido" : "remédios conferidos"}.
        </p>
      </div>

      {meds.length > 0 ? (
        <section className="rounded-card bg-brand-soft p-4">
          <p className="text-[22px] font-extrabold text-brand">
            {free.length} de {meds.length} remédios saem de graça
          </p>
          <p className="text-[15px]">no Farmácia Popular, com receita e documento.</p>
        </section>
      ) : null}

      {free.length > 0 ? (
        <section className="overflow-hidden rounded-card border border-line-soft bg-surface">
          <h2 className="flex items-center gap-2 px-4 pt-3.5 text-[17px] font-extrabold">
            <GiftIcon size={20} className="text-brand" />
            Grátis
          </h2>
          <ul className="px-4 py-1">
            {free.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="font-semibold">{medLabel(m.name, m.strength)}</span>
                <StatusPill tone="ok">Grátis</StatusPill>
              </li>
            ))}
          </ul>
          <Link
            href="/family/onde-pegar"
            className="flex items-center justify-between border-t border-line-soft px-4 py-3.5 font-bold text-brand no-underline"
          >
            Onde pegar perto de casa
            <ChevronRightIcon size={20} />
          </Link>
        </section>
      ) : null}

      {paid.length > 0 ? (
        <section className="overflow-hidden rounded-card border border-line-soft bg-surface">
          <h2 className="flex items-center gap-2 px-4 pt-3.5 text-[17px] font-extrabold">
            <CartIcon size={20} className="text-warn" />
            Precisa comprar
          </h2>
          <ul className="px-4 py-1">
            {paid.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="font-semibold">{medLabel(m.name, m.strength)}</span>
                <b className="whitespace-nowrap">
                  {m.monthlyCostCents > 0 ? `${brl.format(m.monthlyCostCents / 100)}/mês` : ""}
                </b>
              </li>
            ))}
          </ul>
          <Link
            href="/family/comprar"
            className="flex items-center justify-between border-t border-line-soft px-4 py-3.5 font-bold text-brand no-underline"
          >
            Ver preços e dividir
            <ChevronRightIcon size={20} />
          </Link>
        </section>
      ) : null}

      <Link href="/family" className={cn(buttonClass(), "mt-auto")}>
        Ir para o painel
      </Link>
    </>
  );
}

export function PrescriptionReview() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [step, setStep] = useState<"pick" | "reading" | "review" | "saving" | "done">("pick");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [family, setFamily] = useState<FamilyOverview | null>(null);

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(f: File | null) {
    setPreview(null);
    setFile(f);
    setError(null);
  }

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

  const invalid = drafts.filter((d) => !d.name.trim());

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
          times: d.times,
        })),
      );
      setFamily(await getFamily().catch(() => null));
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não deu para salvar.");
      setStep("review");
    }
  }

  if (step === "done") return <Result family={family} count={drafts.length} />;

  if (step === "reading") return <ReadingSteps />;

  if (step === "review" || step === "saving") {
    return (
      <>
        <TopBar onBack={() => setStep("pick")}>Receita nova</TopBar>
        <header className="flex flex-col gap-1">
          <h1 className="text-[28px] font-extrabold leading-tight">Confira o que eu li</h1>
          <p className="text-[16px] leading-snug text-muted">
            Compare com a receita. Toque no lápis para corrigir. Os horários viram lembretes.
          </p>
        </header>
        {warnings.map((w) => (
          <div
            key={w}
            className="flex gap-2 rounded-card border-[1.5px] border-warn bg-warn-soft p-3.5 text-[15px] leading-snug"
          >
            <AlertIcon size={20} className="mt-0.5 shrink-0 text-warn" />
            {w}
          </div>
        ))}
        {drafts.map((d) => (
          <section
            key={d.key}
            className={cn(
              "flex flex-col gap-3 rounded-card bg-surface p-4",
              d.review ? "border-[1.5px] border-warn" : "border border-line-soft",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-col">
                <h2 className="text-[19px] font-extrabold leading-snug">
                  {medLabel(d.name || "Sem nome", d.strength || null)}
                </h2>
                <span className="text-[15px] text-muted">
                  {d.posology}
                  {d.instructions && !d.posology.toLowerCase().includes(d.instructions.toLowerCase())
                    ? `. ${d.instructions}`
                    : ""}
                </span>
              </div>
              <button
                type="button"
                aria-pressed={d.editing}
                onClick={() => update(d.key, { editing: !d.editing })}
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-full border",
                  d.editing ? "border-brand bg-brand-soft text-brand" : "border-line-soft",
                )}
              >
                <PencilIcon size={20} />
                <span className="sr-only">Corrigir {d.name}</span>
              </button>
            </div>
            {d.review ? (
              <p className="flex items-start gap-2 text-[15px] leading-snug text-warn">
                <AlertIcon size={18} className="mt-0.5 shrink-0" />
                {d.review}
              </p>
            ) : null}
            {d.editing ? (
              <div className="flex flex-col gap-3 rounded-2xl bg-bg p-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[15px] font-bold">Nome</span>
                  <input
                    className={inputClass}
                    value={d.name}
                    aria-invalid={!d.name.trim()}
                    onChange={(e) => update(d.key, { name: e.target.value })}
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-[15px] font-bold">Dose</span>
                    <input
                      className={inputClass}
                      value={d.strength}
                      placeholder="50 mg"
                      onChange={(e) => update(d.key, { strength: e.target.value })}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[15px] font-bold">Princípio ativo</span>
                    <input
                      className={inputClass}
                      value={d.activeIngredient}
                      onChange={(e) => update(d.key, { activeIngredient: e.target.value })}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => setDrafts((ds) => ds.filter((x) => x.key !== d.key))}
                  className="min-h-11 rounded-xl text-[16px] font-bold text-danger"
                >
                  Tirar da lista
                </button>
              </div>
            ) : null}
            <TimeChips times={d.times} onChange={(times) => update(d.key, { times })} />
            {d.times.length === 0 ? (
              <p className="text-[15px] text-muted">Sem horário: fica salvo, mas sem lembrete.</p>
            ) : null}
          </section>
        ))}
        <p className="text-[15px] leading-snug text-muted">
          O Recuidado só organiza os horários. Dúvida sobre dose, fale com o médico.
        </p>
        {error ? <p className="font-semibold text-danger">{error}</p> : null}
        <Button onClick={save} disabled={step === "saving" || drafts.length === 0 || invalid.length > 0}>
          <CheckIcon size={22} />
          {step === "saving" ? "Salvando..." : "Está certo, salvar"}
        </Button>
      </>
    );
  }

  return (
    <>
      <TopBar backHref="/family">Receita nova</TopBar>
      <header className="flex flex-col gap-1">
        <h1 className="text-[28px] font-extrabold leading-tight">Foto da receita</h1>
        <p className="text-[16px] leading-snug text-muted">
          Deixe a receita inteira na foto, com boa luz. Você confere tudo antes de salvar.
        </p>
      </header>
      <label
        className={cn(
          "relative flex min-h-[320px] cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-[24px] border-2 border-dashed text-center",
          file ? "border-brand bg-surface" : "border-[#cfc8ba] bg-surface hover:border-brand",
        )}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Foto escolhida da receita" className="absolute inset-0 size-full object-cover" />
        ) : (
          <>
            <span className="flex size-20 items-center justify-center rounded-[24px] bg-brand-soft text-brand">
              <CameraIcon size={40} />
            </span>
            <b className="text-[19px]">{file ? file.name : "Tirar ou escolher foto"}</b>
            <span className="px-6 text-[15px] text-muted">Foto ou PDF da receita</span>
          </>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          capture="environment"
          className="sr-only"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />
      </label>
      {error ? (
        <p role="alert" className="font-semibold text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-auto flex flex-col gap-2">
        <Button onClick={read} disabled={!file}>
          Ler a receita
        </Button>
        {file ? (
          <label className={buttonClass({ variant: "secondary" })}>
            Trocar foto
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              capture="environment"
              className="sr-only"
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
          </label>
        ) : null}
      </div>
    </>
  );
}
