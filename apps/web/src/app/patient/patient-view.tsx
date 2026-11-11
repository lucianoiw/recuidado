"use client";

import { useCallback, useEffect, useState } from "react";
import { EnableNotifications } from "@/components/enable-notifications";
import { confirmDose, formatTime, getFamily, type FamilyOverview } from "@/lib/api";

export function PatientView() {
  const [data, setData] = useState<FamilyOverview | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    getFamily().then(
      (d) => {
        setData(d);
        setNow(Date.now());
        setError(false);
      },
      () => setError(true),
    );
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  if (error) return <p className="text-xl text-zinc-600">Sem conexão. Tente de novo em instantes.</p>;
  if (!data) return <p className="text-xl text-zinc-600">Carregando...</p>;

  // The dose to confirm: the earliest one not taken whose time has come.
  const due = data.today.find(
    (d) => d.status !== "taken" && new Date(d.scheduledAt).getTime() <= now,
  );
  const next = data.today.find(
    (d) => d.status === "pending" && new Date(d.scheduledAt).getTime() > now,
  );

  async function confirm(id: string) {
    setBusy(true);
    try {
      await confirmDose(id);
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-8">
      <p className="text-2xl text-zinc-700">Olá, {data.patient.name}</p>
      {due ? (
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-xl text-zinc-600">Remédio das {formatTime(due.scheduledAt)}</p>
            <h1 className="mt-2 text-4xl font-semibold">
              {due.medicationName} {due.strength}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => confirm(due.id)}
            disabled={busy}
            className="w-full rounded-2xl bg-teal-700 py-8 text-3xl font-semibold text-white active:bg-teal-800 disabled:opacity-60"
          >
            Tomei
          </button>
        </div>
      ) : (
        <div>
          <h1 className="text-3xl font-semibold text-teal-700">Tudo certo por agora</h1>
          {next ? (
            <p className="mt-3 text-xl text-zinc-600">
              Próximo: {next.medicationName} às {formatTime(next.scheduledAt)}
            </p>
          ) : null}
        </div>
      )}

      {data.today.length > 0 ? (
        <ul className="flex flex-col gap-3 text-left text-lg">
          {data.today.map((d) => (
            <li key={d.id} className="flex justify-between border-b border-zinc-200 pb-2">
              <span>
                {formatTime(d.scheduledAt)} {d.medicationName}
              </span>
              <span className={d.status === "taken" ? "text-teal-700" : "text-zinc-500"}>
                {d.status === "taken" ? "Tomado" : d.status === "missed" ? "Não confirmado" : "A tomar"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <EnableNotifications memberId={data.patient.id} label="Receber lembretes no celular" large />
    </div>
  );
}
