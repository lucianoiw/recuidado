"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, InfoIcon, PhoneIcon, StatusPill } from "@/components/ui";
import { captureError, track } from "@/lib/analytics";
import {
  askPharmacy,
  getLatestPharmacyInquiry,
  type Medication,
  type PharmacyInquiry,
  type PharmacyRound,
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

/** "Perguntar às farmácias": the agent calls them at the same time, asks stock and price, and compares. */
export function PharmacyCallCard({ medications }: { medications: Medication[] }) {
  const [round, setRound] = useState<PharmacyRound>({ inquiry: null, inquiries: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getLatestPharmacyInquiry().then(setRound, (e) => captureError(e, { component: "PharmacyCallCard" }));
  }, []);

  useEffect(load, [load]);

  const inquiries = round.inquiries;
  // While a phone rings, check every 3 seconds.
  const calling = inquiries.some((i) => i.status === "calling");
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
      setRound(await askPharmacy(asked.map((m) => m.id)));
      track("pharmacy_call_asked", { medications: asked.length });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const answered = inquiries.filter((i) => i.status === "answered");
  const several = inquiries.length > 1;

  return (
    <section className="flex flex-col gap-3 rounded-card border border-line-soft bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-brand-soft text-brand">
          <PhoneIcon size={22} />
        </span>
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[18px] font-extrabold">Perguntar às farmácias</h2>
          <p className="text-[15px] leading-snug text-muted">
            O Recuidado liga para as farmácias ao mesmo tempo, pergunta se tem, quanto custa e se sai pelo Farmácia
            Popular, e compara os preços.
          </p>
        </div>
      </div>

      {inquiries.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {inquiries.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 text-[15px]">
              <b>{i.pharmacyName}</b>
              <StatusPill tone={CALL_STATE[i.status].tone}>{CALL_STATE[i.status].text}</StatusPill>
            </li>
          ))}
        </ul>
      ) : null}

      {answered.length > 0 ? <Comparison inquiries={answered} medications={medications} several={several} /> : null}

      {!several && inquiries[0] && ENDED[inquiries[0].status] ? (
        <p className="text-[15px] text-muted">{ENDED[inquiries[0].status]}</p>
      ) : null}

      {inquiries.some((i) => i.transcript.length > 0) ? (
        <div className="flex flex-col gap-1">
          {inquiries
            .filter((i) => i.transcript.length > 0)
            .map((i) => (
              <Conversation key={i.id} inquiry={i} />
            ))}
        </div>
      ) : null}

      {!calling ? (
        <Button variant="secondary" onClick={ask} disabled={busy || asked.length === 0}>
          <PhoneIcon size={20} />
          {busy ? "Ligando..." : inquiries.length > 0 ? "Perguntar de novo" : "Ligar e perguntar"}
        </Button>
      ) : null}
      {error ? (
        <p role="alert" className="text-[15px] font-bold text-danger">
          {error}
        </p>
      ) : null}

      <p className="flex items-start gap-2 text-[14px] leading-snug text-muted">
        <InfoIcon size={16} className="mt-0.5 shrink-0" />
        Quem liga é uma assistente virtual, e ela se apresenta assim. Na demonstração, as farmácias são simuladas: o
        menu de teclas é de verdade e quem atende é outra IA, com preços de exemplo. Nenhuma farmácia de verdade
        recebe a ligação. Preço dito por telefone é referência, não oferta.
      </p>
    </section>
  );
}

const CALL_STATE: Record<PharmacyInquiry["status"], { text: string; tone: "ok" | "warn" | "danger" | "neutral" }> = {
  calling: { text: "Ligando...", tone: "warn" },
  answered: { text: "Respondeu", tone: "ok" },
  unclear: { text: "Não entendi", tone: "neutral" },
  no_answer: { text: "Não atendeu", tone: "neutral" },
  failed: { text: "Não completou", tone: "danger" },
};

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

/** One block per medicine, the pharmacies from the cheapest box to the most expensive. */
function Comparison({
  inquiries,
  medications,
  several,
}: {
  inquiries: PharmacyInquiry[];
  medications: Medication[];
  several: boolean;
}) {
  const asked = inquiries[0].medications;
  return (
    <div className="flex flex-col gap-3">
      {asked.map((m, idx) => {
        const ceiling = medications.find((x) => x.id === m.medicationId)?.price ?? null;
        const offers = inquiries
          .map((inq) => ({ inq, a: inq.answers[idx] }))
          .sort((x, y) => (x.a?.priceCents ?? Infinity) - (y.a?.priceCents ?? Infinity));
        const priced = offers.filter((o) => o.a?.available !== "no" && o.a?.priceCents != null);
        const cheapest = several && priced.length > 1 ? priced[0].inq.id : null;
        return (
          <div key={m.medicationId} className="flex flex-col gap-1.5">
            <b className="text-[17px]">{medLabel(m.name, m.strength)}</b>
            <ul className="overflow-hidden rounded-xl border border-line-soft">
              {offers.map(({ inq, a }) => {
                const popular = a ? POPULAR[a.farmaciaPopular] : null;
                const compare = a?.priceCents != null && ceiling ? vsCeiling(a.priceCents, a.package, ceiling) : null;
                return (
                  <li key={inq.id} className="flex flex-col gap-1 border-b border-line-soft px-3.5 py-3 last:border-b-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-bold">{inq.pharmacyName}</span>
                      {cheapest === inq.id ? (
                        <StatusPill tone="ok">Mais barato</StatusPill>
                      ) : (
                        <StatusPill tone={STOCK[a?.available ?? "unknown"].tone}>
                          {STOCK[a?.available ?? "unknown"].text}
                        </StatusPill>
                      )}
                    </div>
                    {a?.available !== "no" ? (
                      <span className="text-[15px] text-muted">
                        {a?.priceCents != null ? (
                          <>
                            <b className="text-[17px] text-ink">{brl.format(a.priceCents / 100)}</b>
                            {a.package ? `, ${a.package}` : " a caixa"}
                            {compare === "above" ? (
                              <b className="text-danger">. Acima do teto da CMED</b>
                            ) : compare === "within" ? (
                              <span>. Dentro do teto</span>
                            ) : null}
                          </>
                        ) : (
                          "Não disse o preço"
                        )}
                      </span>
                    ) : null}
                    {popular ? <span className="text-[15px] text-muted">{popular}</span> : null}
                  </li>
                );
              })}
            </ul>
            {ceiling ? (
              <span className="text-[14px] text-muted">
                Teto CMED: {brl.format(ceiling.packCents / 100)} a caixa com {ceiling.unitsPerPack}
              </span>
            ) : null}
          </div>
        );
      })}
      {inquiries
        .filter((i) => i.note)
        .map((i) => (
          <p key={i.id} className="text-[15px]">
            <b>{i.pharmacyName}:</b> {i.note}
          </p>
        ))}
    </div>
  );
}

function Conversation({ inquiry }: { inquiry: PharmacyInquiry }) {
  return (
    <details className="text-[15px]">
      <summary className="cursor-pointer font-bold">
        Ver a conversa com a {inquiry.pharmacyName}
        {inquiry.usedPhoneMenu ? " (passou pelo menu de teclas)" : ""}
      </summary>
      <ul className="mt-2 flex flex-col gap-1.5">
        {inquiry.transcript.map((line, i) => (
          <li key={i}>
            <b>{line.speaker === "assistant" ? "Recuidado" : "Farmácia"}:</b> {line.text}
          </li>
        ))}
      </ul>
    </details>
  );
}
