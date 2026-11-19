"use client";

import { useEffect, useState } from "react";
import { MedPhotoField } from "@/components/med-photo-field";
import { StockField } from "@/components/stock-field";
import { TimeChips } from "@/components/time-chips";
import { Button, Field, InfoIcon, Sheet, cn } from "@/components/ui";
import { searchMedications, strengthChoices } from "@/lib/med-search";
import { isFree, removeMedication, saveHighCost, updateMedication, type Medication } from "@/lib/api";
import { parseUnits } from "@/lib/stock";
import { brl, medLabel } from "@/lib/use-family";
import { usePronouns } from "@/lib/pronouns";

type HowGot = "normal" | "discount" | "high_cost";

/** "89,90" or "R$ 89,90" in cents; undefined when it is not a price, null when empty. */
function parseCents(text: string): number | null | undefined {
  const clean = text.replace(/[^\d,.]/g, "").trim();
  if (!clean) return null;
  const n = Number(clean.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 && n <= 100_000 ? Math.round(n * 100) : undefined;
}

const centsText = (c: number) => (c / 100).toFixed(2).replace(".", ",");

/** Today in São Paulo, "2026-11-19". */
const todaySp = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

/** Change the dose text, the times or the pills at home of a medication, or stop it. */
export function EditMedSheet({
  med,
  onClose,
  onSaved,
  calls = true,
}: {
  med: Medication | null;
  onClose: () => void;
  onSaved: () => void;
  /** The family gets calls (paid plan). Without it, nothing here mentions calls. */
  calls?: boolean;
}) {
  return (
    <Sheet open={med !== null} onClose={onClose} title={med ? medLabel(med.name, null) : ""}>
      {med ? <EditForm key={med.id} med={med} onClose={onClose} onSaved={onSaved} calls={calls} /> : null}
    </Sheet>
  );
}

function EditForm({
  med,
  onClose,
  onSaved,
  calls,
}: {
  med: Medication;
  onClose: () => void;
  onSaved: () => void;
  calls: boolean;
}) {
  const [strength, setStrength] = useState(med.strength ?? "");
  const [times, setTimes] = useState<string[]>(med.times);
  const initialUnits = med.stock ? String(med.stock.units) : "";
  const [units, setUnits] = useState(initialUnits);
  const parsedUnits = parseUnits(units);
  const pr = usePronouns();
  // How the family gets it: CMED price, a discount price it typed, or free in the Alto Custo.
  const initialHow: HowGot = med.highCostReceiving ? "high_cost" : med.paidPackCents ? "discount" : "normal";
  const [how, setHow] = useState<HowGot>(initialHow);
  const initialPack = med.paidPackCents ? centsText(med.paidPackCents) : "";
  const [pack, setPack] = useState(initialPack);
  const packCents = parseCents(pack);
  const packInvalid = how === "discount" && (packCents === undefined || packCents === null);
  // Free in Farmácia Popular or at the UBS and the family gets it there: nothing to ask.
  const askHow = !(isFree(med) && !med.buyInsteadOfFree && !med.highCostReceiving);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Strengths this medication is sold in, to pick instead of typing.
  const [choices, setChoices] = useState<string[]>([]);

  useEffect(() => {
    const ctrl = new AbortController();
    searchMedications(med.name, ctrl.signal).then(
      (rs) => {
        const key = med.name.trim().toLowerCase();
        const hit = rs.find((r) => r.name.trim().toLowerCase() === key) ?? rs[0];
        const list = hit ? strengthChoices(hit).map((c) => c.strength) : [];
        setChoices(list);
        // "5MG" saved from the prescription is the "5 mg" of the list: select it.
        const same = list.find((c) => c.replace(/\s/g, "").toLowerCase() === (med.strength ?? "").replace(/\s/g, "").toLowerCase());
        if (same) setStrength(same);
      },
      () => {},
    );
    return () => ctrl.abort();
  }, [med.name, med.strength]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não deu para salvar.");
    } finally {
      setBusy(false);
    }
  }

  if (confirming) {
    return (
      <>
        <p className="text-[17px] leading-snug">
          Remover <b>{medLabel(med.name, med.strength)}</b> dos remédios {pr.dela}?
        </p>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-[15px] leading-snug text-muted">
          <li>{calls ? "Os lembretes e as ligações dele param." : "Os lembretes dele param."}</li>
          <li>O histórico do que {pr.ela} já tomou fica guardado.</li>
          <li>Se {pr.ela} voltar a tomar, é só adicionar de novo.</li>
        </ul>
        {error ? (
          <p role="alert" className="font-semibold text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          <Button variant="danger" disabled={busy} onClick={() => run(() => removeMedication(med.id))}>
            {busy ? "Removendo..." : "Sim, remover"}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>
            Voltar
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      {choices.length > 0 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[15px] font-semibold">Dose</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {choices.map((c) => {
              const on = strength === c;
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setStrength(c)}
                  className={cn(
                    "min-h-11 rounded-xl px-3.5 text-[16px]",
                    on
                      ? "border-2 border-brand bg-brand-soft font-semibold text-brand"
                      : "border-[1.5px] border-[#cfc8ba] bg-surface font-semibold text-ink",
                  )}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <Field label="Dose" value={strength} onValue={setStrength} autoComplete="off" placeholder="50 mg" />
      )}
      <div className="flex flex-col gap-2">
        <span className="text-[15px] font-semibold">Horários</span>
        <TimeChips times={times} onChange={setTimes} />
      </div>
      {askHow ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[15px] font-semibold">Como vocês pegam?</legend>
          <div className="flex flex-col gap-2" role="radiogroup">
            {(
              [
                ["normal", "Compra no preço normal", med.price ? `Até ${brl.format(med.price.packCents / 100)} a caixa (preço máximo CMED)` : "Preço da farmácia"],
                ["discount", "Compra com desconto", "Programa do laboratório ou preço combinado na farmácia"],
                ...(med.highCost || med.highCostReceiving
                  ? [["high_cost", "Grátis pelo Alto Custo", "O laudo já foi aprovado e retiram na farmácia do Estado"]]
                  : []),
              ] as [HowGot, string, string][]
            ).map(([value, label, hint]) => {
              const on = how === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setHow(value)}
                  className={cn(
                    "flex min-h-12 flex-col rounded-2xl px-3.5 py-2.5 text-left",
                    on ? "border-2 border-brand bg-brand-soft" : "border-[1.5px] border-[#cfc8ba] bg-surface",
                  )}
                >
                  <span className={cn("text-[16px] font-semibold", on ? "text-brand" : "text-ink")}>{label}</span>
                  <span className="text-[14px] leading-snug text-muted">{hint}</span>
                </button>
              );
            })}
          </div>
          {how === "discount" ? (
            <Field
              label="Quanto pagam por caixa?"
              value={pack}
              onValue={setPack}
              inputMode="decimal"
              autoComplete="off"
              placeholder="R$ 0,00"
              hint={
                packInvalid && pack.trim()
                  ? "Digite o valor, por exemplo 89,90."
                  : med.price
                    ? `Caixa com ${med.price.unitsPerPack}. Esse valor entra no gasto do mês e na divisão.`
                    : "Esse valor entra no gasto do mês e na divisão."
              }
            />
          ) : null}
          {how === "high_cost" && !med.highCostReceiving ? (
            <p className="text-[14px] leading-snug text-muted">
              Sai da lista de compras e entra na economia do mês. O lembrete da renovação conta a partir de hoje: a
              data certa da aprovação você muda no caminho do Alto Custo.
            </p>
          ) : null}
        </fieldset>
      ) : null}
      <StockField value={units} onValue={setUnits} invalid={parsedUnits === undefined} />
      <MedPhotoField med={med} onChanged={onSaved} />
      <p className="flex items-start gap-2 text-[14px] leading-snug text-muted">
        <InfoIcon size={18} className="mt-0.5 shrink-0" />
        Mude a dose, o horário ou remova o remédio só com orientação do médico.
      </p>
      {error ? (
        <p role="alert" className="font-semibold text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Button
          disabled={busy || times.length === 0 || parsedUnits === undefined || packInvalid}
          onClick={() =>
            run(async () => {
              const paidPackCents = how === "discount" ? (packCents ?? null) : null;
              await updateMedication(med.id, {
                strength: strength.trim() || null,
                times,
                // Only when changed: saving the count again restarts it from now.
                ...(units.trim() !== initialUnits ? { stockUnits: parsedUnits } : {}),
                ...(askHow && paidPackCents !== (med.paidPackCents ?? null) ? { paidPackCents } : {}),
              });
              // Approved in the Alto Custo from today; leaving that option takes the approval back.
              if (askHow && how !== initialHow && (how === "high_cost" || initialHow === "high_cost")) {
                await saveHighCost(med.id, { since: how === "high_cost" ? todaySp() : null });
              }
            })
          }
        >
          {busy ? "Salvando..." : "Salvar mudanças"}
        </Button>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="min-h-12 font-semibold text-danger"
        >
          Remover dos remédios
        </button>
      </div>
    </>
  );
}
