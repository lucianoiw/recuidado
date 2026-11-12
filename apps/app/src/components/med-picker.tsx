"use client";

import { MedSearch } from "@/components/med-search";
import { FreeIcon, cn } from "@/components/ui";
import { searchMedications, strengthChoices, type MedResult } from "@/lib/med-search";

const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();

/**
 * The one medicine in the CMED list that matches a name read from a prescription, or null when
 * there is none or more than one could fit (then the family picks). "Losartana potássica" finds
 * its generic; "Diclofenaco" stays open because it can be sódico, potássico and others.
 */
export async function matchMedication(name: string, ingredient?: string | null): Promise<MedResult | null> {
  for (const wanted of [name, ingredient]) {
    if (!wanted?.trim()) continue;
    const results = await searchMedications(wanted).catch(() => []);
    const words = fold(wanted).split(" ");
    const combo = wanted.includes("+");
    const hits = results.filter((m) => {
      if (m.kind !== "generic" || (!combo && m.name.includes("+"))) return false;
      const have = fold(m.name).split(" ");
      return words.every((w) => have.includes(w));
    });
    if (hits.length === 1) return hits[0]!;
    if (hits.length > 1) return null;
    // A brand written as such ("Entresto"): only when exactly one product has that name.
    const brands = results.filter((m) => m.kind === "brand" && fold(m.name) === fold(wanted));
    if (brands.length === 1) return brands[0]!;
  }
  return null;
}

/** Strength the family can pick for this medicine, matching what was read when possible. */
export function matchStrength(m: MedResult, read: string): string {
  const choices = strengthChoices(m);
  if (choices.length === 1) return choices[0]!.strength;
  const f = fold(read).replace(/\s/g, "");
  return choices.find((c) => fold(c.strength).replace(/\s/g, "") === f)?.strength ?? "";
}

/**
 * Medicine field tied to the CMED list: the family types, picks one medicine (so "Diclofenaco
 * sódico" and "Diclofenaco potássico" never get mixed up) and then picks one of its strengths.
 * Free text is never saved.
 */
export function MedPicker({
  query,
  onQuery,
  med,
  onMed,
  strength,
  onStrength,
  tried,
}: {
  query: string;
  onQuery: (q: string) => void;
  med: MedResult | null;
  onMed: (m: MedResult | null) => void;
  strength: string;
  onStrength: (s: string) => void;
  tried?: boolean;
}) {
  if (!med) {
    return (
      <div className="flex flex-col gap-1.5">
        <MedSearch
          value={query}
          onValue={onQuery}
          onPick={(m) => {
            onMed(m);
            const choices = strengthChoices(m);
            onStrength(choices.length === 1 ? choices[0]!.strength : "");
          }}
          invalid={tried}
        />
        <span className={cn("text-[14px]", tried ? "font-semibold text-danger" : "text-muted")}>
          Escolha o remédio na lista. Assim o app sabe exatamente qual é.
        </span>
      </div>
    );
  }

  const choices = strengthChoices(med);
  const forms = new Map(med.strengths.map((s) => [s.strength, s.form]));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 rounded-2xl border border-line-soft bg-surface px-4 py-3 shadow-[0_12px_28px_-16px_rgba(22,19,20,0.35)]">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[17px] font-semibold leading-snug">{med.name}</span>
          <span className="text-[14px] text-muted">
            {med.kind === "generic" ? "Genérico" : med.activeIngredient}
          </span>
        </span>
        <button
          type="button"
          onClick={() => {
            onMed(null);
            onStrength("");
          }}
          className="min-h-11 shrink-0 rounded-full border border-line bg-bg px-4 text-[15px] font-semibold"
        >
          Trocar
        </button>
      </div>
      {choices.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-[15px] font-semibold">Dose</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label={`Doses de ${med.name}`}>
            {choices.map((c) => {
              const on = strength === c.strength;
              const form = forms.get(c.strength);
              return (
                <button
                  key={c.strength}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onStrength(c.strength)}
                  className={cn(
                    "inline-flex min-h-11 flex-col items-start justify-center rounded-2xl border px-3.5 py-1.5 text-left",
                    on ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink",
                  )}
                >
                  <span className="flex items-center gap-1.5 text-[16px] font-semibold">
                    {c.strength}
                    {c.free ? <FreeIcon size={15} className={on ? "text-white" : "text-ok"} /> : null}
                  </span>
                  {form ? <span className={cn("text-[13px]", on ? "text-white/80" : "text-muted")}>{form}</span> : null}
                </button>
              );
            })}
          </div>
          {tried && !strength ? (
            <span className="text-[14px] font-semibold text-danger">Escolha a dose.</span>
          ) : choices.some((c) => c.free) ? (
            <span className="flex items-center gap-1.5 text-[14px] text-muted">
              <FreeIcon size={16} className="text-ok" />
              Pode sair grátis no Farmácia Popular ou na UBS.
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** True when the pick is complete: a medicine and, when it has strengths, one of them. */
export function pickComplete(med: MedResult | null, strength: string): boolean {
  return med !== null && (strengthChoices(med).length === 0 || strength !== "");
}
