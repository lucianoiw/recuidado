"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { EnableNotifications } from "@/components/enable-notifications";
import { formatTime, getFamily, type Dose, type FamilyOverview } from "@/lib/api";

const ME_KEY = "recuidado:caregiver";

const meListeners = new Set<() => void>();

function readMe(): string | null {
  try {
    return localStorage.getItem(ME_KEY);
  } catch {
    return null;
  }
}

function writeMe(id: string) {
  try {
    localStorage.setItem(ME_KEY, id);
  } catch {}
  meListeners.forEach((l) => l());
}

function subscribeMe(listener: () => void) {
  meListeners.add(listener);
  return () => meListeners.delete(listener);
}

function statusLabel(d: Dose, now: number): { text: string; tone: string } {
  if (d.status === "taken") {
    return {
      text: `Tomou${d.confirmedVia === "voice" ? " (por ligação)" : ""}${
        d.confirmedAt ? ` às ${formatTime(d.confirmedAt)}` : ""
      }`,
      tone: "text-teal-700",
    };
  }
  if (d.status === "missed") return { text: "Não confirmou", tone: "text-red-700 font-medium" };
  if (new Date(d.scheduledAt).getTime() <= now) {
    return { text: "Aguardando confirmação", tone: "text-amber-700" };
  }
  return { text: "Agendado", tone: "text-zinc-500" };
}

export function FamilyView() {
  const [data, setData] = useState<FamilyOverview | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(0);
  const me = useSyncExternalStore(subscribeMe, readMe, () => null);

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

  if (error) return <p className="text-zinc-600">Sem conexão com o servidor.</p>;
  if (!data) return <p className="text-zinc-600">Carregando...</p>;

  const caregiver = data.caregivers.find((c) => c.id === me);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="text-lg font-semibold">Doses de hoje da {data.patient.name}</h2>
        {data.today.length === 0 ? (
          <p className="mt-2 text-zinc-600">Nenhuma dose hoje.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {data.today.map((d) => {
              const s = statusLabel(d, now);
              return (
                <li key={d.id} className="flex justify-between gap-4 rounded-lg border border-zinc-200 p-3">
                  <span>
                    <span className="font-medium">{formatTime(d.scheduledAt)}</span> {d.medicationName}{" "}
                    {d.strength}
                  </span>
                  <span className={`text-right text-sm ${s.tone}`}>{s.text}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Remédios</h2>
        {data.medications.length === 0 ? (
          <p className="mt-2 text-zinc-600">Nenhum remédio cadastrado ainda.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {data.medications.map((m) => (
              <li key={m.id} className="rounded-lg border border-zinc-200 p-3">
                <p className="font-medium">
                  {m.name} {m.strength}
                </p>
                <p className="text-sm text-zinc-600">
                  {m.times.length > 0 ? `Horários: ${m.times.join(", ")}` : "Sem horário definido"}
                  {m.freeInFarmaciaPopular ? " · Grátis no Farmácia Popular" : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Alertas no celular</h2>
        <p className="text-sm text-zinc-600">
          Se a {data.patient.name} não confirmar um remédio, avisamos você por notificação.
        </p>
        <div className="flex gap-2">
          {data.caregivers.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => writeMe(c.id)}
              className={`rounded-full border px-4 py-2 text-sm ${
                c.id === me ? "border-teal-700 bg-teal-50 text-teal-800" : "border-zinc-300"
              }`}
            >
              Sou {c.name}
            </button>
          ))}
        </div>
        {caregiver ? (
          <EnableNotifications key={caregiver.id} memberId={caregiver.id} label={`Ativar alertas para ${caregiver.name}`} />
        ) : null}
      </section>
    </div>
  );
}
