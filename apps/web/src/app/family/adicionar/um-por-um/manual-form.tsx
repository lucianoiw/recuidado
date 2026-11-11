"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MedSearch } from "@/components/med-search";
import { TimeChips } from "@/components/time-chips";
import { Button, CheckIcon, Field, TopBar, buttonClass } from "@/components/ui";
import { confirmPrescription, getFamily } from "@/lib/api";

export function ManualForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [strength, setStrength] = useState("");
  const [times, setTimes] = useState<string[]>(["08:00"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [tried, setTried] = useState(false);

  async function save(another: boolean) {
    if (!name.trim()) {
      setTried(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { patient } = await getFamily();
      await confirmPrescription(patient.id, [
        { name: name.trim(), activeIngredient: null, strength: strength.trim() || null, times },
      ]);
      setSaved((s) => [...s, [name.trim(), strength.trim()].filter(Boolean).join(" ")]);
      setName("");
      setStrength("");
      setTimes(["08:00"]);
      setTried(false);
      if (!another) router.push("/family/remedios");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não deu para salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <TopBar backHref="/family/adicionar">Adicionar um por um</TopBar>
      <h1 className="text-[28px] font-extrabold leading-tight">Novo remédio</h1>

      {saved.length > 0 ? (
        <p aria-live="polite" className="flex items-start gap-2 rounded-2xl bg-brand-soft p-3.5 text-[15px] font-semibold text-brand">
          <CheckIcon size={18} strokeWidth={2.6} className="mt-0.5 shrink-0" />
          Salvo: {saved.join(", ")}.
        </p>
      ) : null}

      <MedSearch
        value={name}
        onValue={setName}
        onPick={(o) => {
          setName(o.name);
          setStrength(o.strength);
        }}
        invalid={tried && !name.trim()}
      />
      <Field label="Dose" value={strength} onValue={setStrength} autoComplete="off" placeholder="50 mg" />
      <div className="flex flex-col gap-2">
        <span className="text-[15px] font-bold">Horários</span>
        <TimeChips times={times} onChange={setTimes} />
        <span className="text-[14px] text-muted">
          Use 8:00, 12:00 e 20:00 quando der. Assim ela toma tudo junto.
        </span>
      </div>
      <p className="rounded-2xl bg-brand-soft p-3.5 text-[15px] leading-snug">
        Depois de salvar, a gente mostra se ele pode sair grátis no Farmácia Popular ou na UBS.
      </p>

      {error ? (
        <p role="alert" className="font-semibold text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-auto flex flex-col gap-1.5">
        <Button onClick={() => save(false)} disabled={busy}>
          {busy ? "Salvando..." : "Salvar remédio"}
        </Button>
        <button
          type="button"
          onClick={() => save(true)}
          disabled={busy}
          className="min-h-12 font-bold text-brand disabled:opacity-60"
        >
          Salvar e adicionar outro
        </button>
        {saved.length > 0 ? (
          <Link href="/family/remedios" className={buttonClass({ variant: "secondary" })}>
            Terminei
          </Link>
        ) : null}
      </div>
    </>
  );
}
