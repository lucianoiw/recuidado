"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, InfoIcon, PhoneIcon, StatusPill } from "@/components/ui";
import { captureError, track } from "@/lib/analytics";
import {
  askPharmacy,
  getLatestPharmacyInquiry,
  type Medication,
  type PharmacyInquiry,
  type TriState,
} from "@/lib/api";
import { brl, medLabel } from "@/lib/use-family";

/** At most this many medicines per call, the same limit as the API. */
const MAX_PER_CALL = 3;

const STOCK: Record<TriState, { text: string; tone: "ok" | "danger" | "neutral" }> = {
  yes: { text: "Tem", tone: "ok" },
  no: { text: "Não tem", tone: "danger" },
  unknown: { text: "Não disse", tone: "neutral" },
};

const POPULAR: Record<TriState, string | null> = {
  yes: "Sai pelo Farmácia Popular lá",
  no: "Não sai pelo Farmácia Popular lá",
  unknown: null,
};

const ENDED: Partial<Record<PharmacyInquiry["status"], string>> = {
  unclear: "A farmácia atendeu, mas não deu para entender a resposta.",
  no_answer: "A farmácia não atendeu.",
  failed: "A ligação não completou.",
};

/** "Perguntar à farmácia": the agent calls, asks stock and price, and the answer shows up here. */
export function PharmacyCallCard({ medications }: { medications: Medication[] }) {
  const [inquiry, setInquiry] = useState<PharmacyInquiry | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getLatestPharmacyInquiry().then(setInquiry, (e) => captureError(e, { component: "PharmacyCallCard" }));
  }, []);

  useEffect(load, [load]);

  // While the phone rings, check every 3 seconds.
  const calling = inquiry?.status === "calling";
  useEffect(() => {
    if (!calling) return;
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [calling, load]);

  const asked = medications.slice(0, MAX_PER_CALL);
  const ask = async () => {
    setBusy(true);
    setError(null);
    try {
      setInquiry(await askPharmacy(asked.map((m) => m.id)));
      track("pharmacy_call_asked", { medications: asked.length });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-card border border-line-soft bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-brand-soft text-brand">
          <PhoneIcon size={22} />
        </span>
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[18px] font-extrabold">Perguntar à farmácia</h2>
          <p className="text-[15px] leading-snug text-muted">
            O Recuidado liga, pergunta se tem, quanto custa e se sai pelo Farmácia Popular.
          </p>
        </div>
      </div>

      {calling ? (
        <StatusPill tone="warn" className="w-fit">
          Ligando para {inquiry.pharmacyName}...
        </StatusPill>
      ) : null}

      {inquiry?.status === "answered" ? <Answers inquiry={inquiry} medications={medications} /> : null}

      {inquiry && ENDED[inquiry.status] ? <p className="text-[15px] text-muted">{ENDED[inquiry.status]}</p> : null}

      {!calling ? (
        <Button variant="secondary" onClick={ask} disabled={busy || asked.length === 0}>
          <PhoneIcon size={20} />
          {busy ? "Ligando..." : inquiry ? "Perguntar de novo" : "Ligar e perguntar"}
        </Button>
      ) : null}
      {error ? (
        <p role="alert" className="text-[15px] font-bold text-danger">
          {error}
        </p>
      ) : null}

      <p className="flex items-start gap-2 text-[14px] leading-snug text-muted">
        <InfoIcon size={16} className="mt-0.5 shrink-0" />
        Quem liga é uma assistente virtual, e ela se apresenta assim. Na demonstração, a ligação vai para um número de
        teste, não para uma farmácia de verdade. Preço dito por telefone é referência, não oferta.
      </p>
    </section>
  );
}

/** Pills in the box as the attendant said it, e.g. "caixa com 30 comprimidos" → 30. */
export function unitsIn(pack: string | undefined): number | null {
  const n = Number(pack?.match(/(\d{1,4})/)?.[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * The phone price against the CMED ceiling, per pill so boxes of different sizes compare.
 * Null when the box size or the CMED price is unknown.
 */
export function vsCeiling(
  priceCents: number,
  pack: string | undefined,
  ceiling: { packCents: number; unitsPerPack: number },
): "above" | "within" | null {
  const units = unitsIn(pack);
  if (!units || ceiling.unitsPerPack <= 0) return null;
  // One cent of rounding either way is not "above".
  return priceCents / units > ceiling.packCents / ceiling.unitsPerPack + 0.01 ? "above" : "within";
}

function Answers({ inquiry, medications }: { inquiry: PharmacyInquiry; medications: Medication[] }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[15px] text-muted">
        Resposta da {inquiry.pharmacyName}
        {inquiry.usedPhoneMenu ? " (passou pelo menu de teclas)" : ""}
      </span>
      <ul className="overflow-hidden rounded-xl border border-line-soft">
        {inquiry.medications.map((m, i) => {
          const a = inquiry.answers[i];
          const popular = a ? POPULAR[a.farmaciaPopular] : null;
          const ceiling = medications.find((x) => x.id === m.medicationId)?.price ?? null;
          const compare = a?.priceCents != null && ceiling ? vsCeiling(a.priceCents, a.package, ceiling) : null;
          return (
            <li key={m.medicationId} className="flex flex-col gap-1 border-b border-line-soft px-3.5 py-3 last:border-b-0">
              <div className="flex items-center justify-between gap-3">
                <b>{medLabel(m.name, m.strength)}</b>
                <StatusPill tone={STOCK[a?.available ?? "unknown"].tone}>{STOCK[a?.available ?? "unknown"].text}</StatusPill>
              </div>
              <span className="text-[15px] text-muted">
                {a?.priceCents != null ? (
                  <>
                    <b className="text-ink">{brl.format(a.priceCents / 100)}</b>
                    {a.package ? `, ${a.package}` : " a caixa"}
                  </>
                ) : (
                  "Não disse o preço"
                )}
              </span>
              {ceiling ? (
                <span className="text-[15px] text-muted">
                  Teto CMED: {brl.format(ceiling.packCents / 100)} a caixa com {ceiling.unitsPerPack}
                  {compare === "above" ? (
                    <b className="text-danger">. Acima do teto</b>
                  ) : compare === "within" ? (
                    <b className="text-brand">. Dentro do teto</b>
                  ) : null}
                </span>
              ) : null}
              {popular ? <span className="text-[15px] text-muted">{popular}</span> : null}
            </li>
          );
        })}
      </ul>
      {inquiry.note ? <p className="text-[15px]">{inquiry.note}</p> : null}
      {inquiry.transcript.length > 0 ? (
        <details className="text-[15px]">
          <summary className="cursor-pointer font-bold">Ver a conversa</summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {inquiry.transcript.map((line, i) => (
              <li key={i}>
                <b>{line.speaker === "assistant" ? "Recuidado" : "Farmácia"}:</b> {line.text}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
