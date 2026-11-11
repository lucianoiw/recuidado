"use client";

import { useState } from "react";
import { TimeChips } from "@/components/time-chips";
import { Button, Field, InfoIcon, Sheet } from "@/components/ui";
import { removeMedication, updateMedication, type Medication } from "@/lib/api";
import { medLabel } from "@/lib/use-family";

/** Change the dose text or the times of a medication, or stop it. */
export function EditMedSheet({
  med,
  onClose,
  onSaved,
}: {
  med: Medication | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Sheet open={med !== null} onClose={onClose} title={med ? medLabel(med.name, null) : ""}>
      {med ? <EditForm key={med.id} med={med} onClose={onClose} onSaved={onSaved} /> : null}
    </Sheet>
  );
}

function EditForm({ med, onClose, onSaved }: { med: Medication; onClose: () => void; onSaved: () => void }) {
  const [strength, setStrength] = useState(med.strength ?? "");
  const [times, setTimes] = useState<string[]>(med.times);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          Tirar <b>{medLabel(med.name, med.strength)}</b> da lista? Os lembretes e as ligações dele
          param.
        </p>
        {error ? (
          <p role="alert" className="font-semibold text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          <Button variant="danger" disabled={busy} onClick={() => run(() => removeMedication(med.id))}>
            {busy ? "Tirando..." : "Sim, tirar da lista"}
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
      <Field label="Dose" value={strength} onValue={setStrength} autoComplete="off" placeholder="50 mg" />
      <div className="flex flex-col gap-2">
        <span className="text-[15px] font-bold">Horários</span>
        <TimeChips times={times} onChange={setTimes} />
      </div>
      <p className="flex items-start gap-2 text-[14px] leading-snug text-muted">
        <InfoIcon size={18} className="mt-0.5 shrink-0" />
        Mude a dose, o horário ou pare o remédio só com orientação do médico.
      </p>
      {error ? (
        <p role="alert" className="font-semibold text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Button
          disabled={busy || times.length === 0}
          onClick={() => run(() => updateMedication(med.id, { strength: strength.trim() || null, times }))}
        >
          {busy ? "Salvando..." : "Salvar mudanças"}
        </Button>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="min-h-12 font-bold text-danger"
        >
          Parar este remédio
        </button>
      </div>
    </>
  );
}
