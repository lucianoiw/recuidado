"use client";

import { callName } from "@/lib/api";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckIcon,
  ChevronRightIcon,
  InfoIcon,
  NavigationIcon,
  Segmented,
  cn,
  pillClass,
} from "@/components/ui";
import { PageTitle } from "@/components/page-title";
import { PlacesMap } from "@/components/places-map";
import {
  formatDistance,
  mapsUrl,
  pharmacies,
  type Pharmacy,
} from "@/lib/pharmacies";
import { highCostUnits, ubsUnits, type SusUnit } from "@/lib/sus-units";
import { medLabel, useFamily } from "@/lib/use-family";

type Tab = "fp" | "ubs";

function PharmacyRow({
  p,
  index,
}: {
  p: Pharmacy;
  index: number;
}) {
  return (
    <li className="flex gap-3 border-b border-line-soft px-4 py-4 last:border-b-0">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blush text-[14px] font-semibold text-accent-ink">
        {index + 1}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <b className="leading-snug">{p.name}</b>
          <span className="whitespace-nowrap text-[14px] text-muted">
            {formatDistance(p.distanceKm)}
          </span>
        </div>
        <span className="text-[15px] leading-snug text-muted">{p.address}</span>
        {p.fpAccredited === null ? (
          <span className="text-[14px] text-muted">
            Credenciamento no Farmácia Popular a confirmar
          </span>
        ) : null}
        <a
          href={mapsUrl(p)}
          target="_blank"
          rel="noreferrer"
          className={cn(pillClass(), "w-fit")}
        >
          <NavigationIcon size={18} />
          Como chegar
        </a>
      </div>
    </li>
  );
}

function UnitRow({
  u,
  index,
}: {
  u: SusUnit;
  index: number;
}) {
  return (
    <li className="flex gap-3 border-b border-line-soft px-4 py-4 last:border-b-0">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blush text-[14px] font-semibold text-accent-ink">
        {index + 1}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <b className="leading-snug">{u.name}</b>
          <span className="whitespace-nowrap text-[14px] text-muted">
            {formatDistance(u.distanceKm)}
          </span>
        </div>
        <span className="text-[15px] leading-snug text-muted">
          {u.address}. {u.hours}.
        </span>
        <a
          href={mapsUrl(u)}
          target="_blank"
          rel="noreferrer"
          className={cn(pillClass(), "w-fit")}
        >
          <NavigationIcon size={18} />
          Como chegar
        </a>
      </div>
    </li>
  );
}

type Med = NonNullable<ReturnType<typeof useFamily>["data"]>["medications"][number];

const atFp = (m: Med) => m.freeInFarmaciaPopular || (m.freeAt?.includes("farmacia_popular") ?? false);
const atUbs = (m: Med) => m.freeAt?.includes("ubs") ?? false;

/** Where this medicine comes from when it is not at the place on screen. */
function elsewhere(m: Med, tab: Tab): string {
  if (tab === "fp" && atUbs(m)) return "Pegue no posto de saúde";
  if (tab === "ubs" && atFp(m)) return "Pegue na Farmácia Popular";
  if (m.highCost) return "Alto Custo, precisa de laudo";
  return "Precisa comprar";
}

/** The patient's medicines split into what this kind of place hands out and what it does not. */
function WhatHere({ meds, tab }: { meds: Med[]; tab: Tab }) {
  const here = meds.filter((m) => (tab === "fp" ? atFp(m) : atUbs(m)));
  const not = meds.filter((m) => !here.includes(m));
  const place = tab === "fp" ? "na Farmácia Popular" : "no posto de saúde";
  return (
    <section className="flex flex-col overflow-hidden rounded-card bg-surface">
      <div className="flex flex-col gap-2 px-4 py-3.5">
        <h2 className="text-[17px] font-semibold">Sai grátis {place}</h2>
        {here.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {here.map((m) => (
              <li key={m.id} className="flex items-center gap-2 text-[16px]">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ok-soft text-ok">
                  <CheckIcon size={14} strokeWidth={2.6} />
                </span>
                {medLabel(m.name, m.strength)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[15px] text-muted">Nenhum remédio da receita sai grátis {place}.</p>
        )}
      </div>
      {not.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-line-soft px-4 py-3.5">
          <h2 className="text-[17px] font-semibold">Não sai {place}</h2>
          <ul className="flex flex-col gap-2">
            {not.map((m) => (
              <li key={m.id} className="flex items-start gap-2 text-[16px]">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-cream text-muted">
                  <XSmall />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span>{medLabel(m.name, m.strength)}</span>
                  <span className="text-[14px] font-semibold text-accent-ink">{elsewhere(m, tab)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function XSmall() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function WhereView() {
  const { data } = useFamily();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(params.get("tab") === "ubs" ? "ubs" : "fp");

  const patient = data ? callName(data.patient) : "a pessoa cuidada";
  const list = pharmacies.slice(0, 6);
  const meds = data?.medications ?? [];
  const highCostMeds = meds.filter((m) => m.highCost);

  return (
    <>
      <PageTitle
        title="Onde pegar grátis"
        subtitle={`Perto do endereço de ${patient}`}
      />

      <Segmented
        label="Tipo de lugar"
        value={tab}
        onChange={setTab}
        options={[
          { value: "fp", label: "Farmácia Popular" },
          { value: "ubs", label: "Posto de saúde" },
        ]}
      />

      {data ? <WhatHere meds={meds} tab={tab} /> : null}

      {tab === "fp" ? (
        <>
          <PlacesMap places={list} homeLabel={`Casa de ${patient}`} />
          <ul className="overflow-hidden rounded-card bg-surface">
            {list.map((p, i) => (
              <PharmacyRow key={p.cnes} p={p} index={i} />
            ))}
          </ul>
          <p className="flex items-start gap-2 text-[15px] leading-snug text-muted">
            <InfoIcon size={18} className="mt-0.5 shrink-0" />
            Farmácias credenciadas no Farmácia Popular, segundo o Ministério da
            Saúde. Leve a receita e um documento com foto de {patient}.
          </p>
        </>
      ) : (
        <>
          <PlacesMap
            places={ubsUnits.slice(0, 3)}
            homeLabel={`Casa de ${patient}`}
          />
          <ul className="overflow-hidden rounded-card bg-surface">
            {ubsUnits.slice(0, 3).map((u, i) => (
              <UnitRow key={u.cnes} u={u} index={i} />
            ))}
          </ul>
          <p className="flex items-start gap-2 text-[15px] leading-snug text-muted">
            <InfoIcon size={18} className="mt-0.5 shrink-0" />A farmácia da UBS
            entrega grátis os remédios da lista da prefeitura (REMUME). Leve a
            receita e o cartão do SUS de {patient}. O estoque muda: ligue antes.
          </p>
          <section className="flex flex-col gap-2 rounded-card bg-surface p-4">
            <h2 className="text-[18px] font-semibold">
              Farmácia de Alto Custo
            </h2>
            <p className="text-[15px] leading-snug text-muted">
              Remédios de doenças específicas, entregues pelo Estado. O médico
              precisa preencher o laudo (LME).
              {highCostMeds.length > 0
                ? null
                : " Nenhum remédio desta receita está nessa lista."}
            </p>
            {highCostMeds.map((m) => (
              <Link
                key={m.id}
                href={`/family/alto-custo/${m.id}`}
                className="inline-flex min-h-11 w-fit items-center gap-1.5 text-[15px] font-semibold text-brand"
              >
                Ver o caminho de {medLabel(m.name, null)}
                <ChevronRightIcon size={18} />
              </Link>
            ))}
            {highCostUnits[0] ? (
              <span className="text-[15px]">
                Mais perto: <b>{highCostUnits[0].name}</b>,{" "}
                {highCostUnits[0].address} (
                {formatDistance(highCostUnits[0].distanceKm)})
              </span>
            ) : null}
          </section>
        </>
      )}
    </>
  );
}
