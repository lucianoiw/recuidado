"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { EnableNotifications } from "@/components/enable-notifications";
import {
  AlertIcon,
  Card,
  DoseList,
  DoseRow,
  ScreenHeader,
  StatusPill,
  buttonClass,
  cn,
  type DoseStatus as RowStatus,
} from "@/components/ui";
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

function rowStatus(d: Dose, now: number): { status: RowStatus; text: string } {
  if (d.status === "taken") {
    const via = d.confirmedVia === "voice" ? " por ligação" : "";
    const at = d.confirmedAt ? ` ${formatTime(d.confirmedAt)}` : "";
    return { status: "taken", text: `Tomou${via}${at}` };
  }
  if (d.status === "missed") return { status: "missed", text: "Não tomou" };
  if (new Date(d.scheduledAt).getTime() <= now) return { status: "pending", text: "Esperando" };
  return { status: "upcoming", text: "Mais tarde" };
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function doseName(d: Dose): string {
  // Keep "50 mg" on one line.
  return [d.medicationName, d.strength?.replace(/ /g, "\u00a0")].filter(Boolean).join(" ");
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

  if (error) return <p className="text-muted">Sem conexão com o servidor.</p>;
  if (!data) return <p className="text-muted">Carregando...</p>;

  const caregiver = data.caregivers.find((c) => c.id === me);
  const patientName = data.patient.name.split(" ")[0];
  const missed = data.today.filter((d) => d.status === "missed");
  const monthlyCents = data.medications.reduce((sum, m) => sum + m.monthlyCostCents, 0);
  const shareCents = data.caregivers.length > 0 ? Math.ceil(monthlyCents / data.caregivers.length) : 0;
  const taken = data.today.filter((d) => d.status === "taken").length;

  return (
    <>
      <ScreenHeader
        audience="family"
        eyebrow={caregiver ? `Olá, ${caregiver.name.split(" ")[0]}` : undefined}
        title={`${patientName} hoje`}
      />

      {missed.map((d) => (
        <Card key={d.id} tone="danger" className="flex flex-col gap-2.5" role="alert">
          <p className="flex items-center gap-2 font-bold text-danger">
            <AlertIcon size={22} strokeWidth={2.4} />
            Dose não confirmada
          </p>
          <p className="leading-snug">
            {doseName(d)} das {formatTime(d.scheduledAt)}.
            {d.familyAlertedAt ? ` Avisamos a família às ${formatTime(d.familyAlertedAt)}.` : ""}
          </p>
        </Card>
      ))}

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[19px] font-bold">Doses de hoje</h2>
          {data.today.length > 0 ? (
            <span className="text-[15px] text-muted">
              {taken} de {data.today.length} tomadas
            </span>
          ) : null}
        </div>
        {data.today.length === 0 ? (
          <Card>
            <p className="text-muted">Nenhuma dose hoje.</p>
          </Card>
        ) : (
          <DoseList>
            {data.today.map((d) => {
              const s = rowStatus(d, now);
              return (
                <DoseRow
                  key={d.id}
                  name={doseName(d)}
                  time={formatTime(d.scheduledAt)}
                  status={s.status}
                  statusText={s.text}
                />
              );
            })}
          </DoseList>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[19px] font-bold">Remédios do mês</h2>
        {data.medications.length === 0 ? (
          <Card>
            <p className="text-muted">Nenhum remédio cadastrado ainda.</p>
          </Card>
        ) : (
          <ul className="flex flex-col rounded-card bg-surface px-4 py-1">
            {data.medications.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 border-b border-line-soft py-3.5 last:border-b-0"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="font-semibold">{[m.name, m.strength?.replace(/ /g, "\u00a0")].filter(Boolean).join(" ")}</span>
                  <span className="text-[15px] text-muted">
                    {m.times.length > 0 ? m.times.join(", ") : "Sem horário definido"}
                  </span>
                </div>
                {m.freeInFarmaciaPopular ? (
                  <StatusPill tone="ok">Grátis</StatusPill>
                ) : (
                  <span className="whitespace-nowrap font-bold">{brl.format(m.monthlyCostCents / 100)}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {data.medications.some((m) => m.freeInFarmaciaPopular) ? (
          <p className="text-[15px] leading-snug text-muted">
            Grátis: retire no Farmácia Popular com a receita e o documento da {patientName}.
          </p>
        ) : null}
      </section>

      {monthlyCents > 0 && data.caregivers.length > 0 ? (
        <Card className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[19px] font-bold">Conta da família</h2>
            <span className="text-[19px] font-bold">{brl.format(monthlyCents / 100)}</span>
          </div>
          <ul className="flex flex-col gap-2">
            {data.caregivers.map((c) => (
              <li key={c.id} className="flex items-center justify-between">
                <span>{c.name.split(" ")[0]}</span>
                <span className="font-semibold">{brl.format(shareCents / 100)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-3">
        <h2 className="text-[19px] font-bold">Alertas no celular</h2>
        <p className="text-[15px] leading-snug text-muted">
          Se a {patientName} não confirmar um remédio, avisamos você por notificação.
        </p>
        <div className="flex flex-wrap gap-2">
          {data.caregivers.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={c.id === me}
              onClick={() => writeMe(c.id)}
              className={cn(
                buttonClass({ variant: c.id === me ? "primary" : "secondary" }),
                "w-auto min-h-11 rounded-full px-4 text-[15px]",
              )}
            >
              Sou {c.name.split(" ")[0]}
            </button>
          ))}
        </div>
        {caregiver ? (
          <EnableNotifications
            key={caregiver.id}
            memberId={caregiver.id}
            label={`Ativar alertas para ${caregiver.name.split(" ")[0]}`}
          />
        ) : null}
      </Card>
    </>
  );
}
