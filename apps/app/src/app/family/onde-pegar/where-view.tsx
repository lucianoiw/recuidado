"use client";

import { callName } from "@/lib/api";
import { useState } from "react";
import Link from "next/link";
import { ChevronRightIcon, InfoIcon, NavigationIcon, Segmented, StatusPill } from "@/components/ui";
import { PageTitle } from "@/components/page-title";
import { PlacesMap } from "@/components/places-map";
import { formatDistance, mapsUrl, pharmacies, type Pharmacy } from "@/lib/pharmacies";
import { highCostUnits, ubsUnits, type SusUnit } from "@/lib/sus-units";
import { medLabel, useFamily } from "@/lib/use-family";

type Tab = "fp" | "ubs";

function PharmacyRow({ p, index, freeMeds }: { p: Pharmacy; index: number; freeMeds: string[] }) {
  return (
    <li className="flex flex-col gap-2 border-b border-line-soft px-4 py-3.5 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <b className="leading-snug">
          {index + 1}. {p.name}
        </b>
        <span className="whitespace-nowrap text-[15px] font-bold text-muted">
          {formatDistance(p.distanceKm)}
        </span>
      </div>
      <span className="text-[15px] leading-snug text-muted">{p.address}</span>
      {p.fpAccredited === true && freeMeds.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {freeMeds.map((m) => (
            <StatusPill key={m} tone="ok" className="px-2.5 py-1 text-[13px]">
              {m} grátis
            </StatusPill>
          ))}
        </div>
      ) : null}
      {p.fpAccredited === null ? (
        <span className="text-[14px] text-muted">Credenciamento no Farmácia Popular a confirmar</span>
      ) : null}
      <a
        href={mapsUrl(p)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl border-[1.5px] border-ink px-3.5 text-[15px] font-bold text-ink no-underline"
      >
        <NavigationIcon size={18} />
        Como chegar
      </a>
    </li>
  );
}

function UnitRow({ u, index, meds }: { u: SusUnit; index: number; meds: string[] }) {
  return (
    <li className="flex flex-col gap-2 border-b border-line-soft px-4 py-3.5 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <b className="leading-snug">
          {index + 1}. {u.name}
        </b>
        <span className="whitespace-nowrap text-[15px] font-bold text-muted">
          {formatDistance(u.distanceKm)}
        </span>
      </div>
      <span className="text-[15px] leading-snug text-muted">
        {u.address}. {u.hours}.
      </span>
      {meds.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {meds.map((m) => (
            <StatusPill key={m} tone="ok" className="px-2.5 py-1 text-[13px]">
              {m} na UBS
            </StatusPill>
          ))}
        </div>
      ) : null}
      <a
        href={mapsUrl(u)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl border-[1.5px] border-ink px-3.5 text-[15px] font-bold text-ink no-underline"
      >
        <NavigationIcon size={18} />
        Como chegar
      </a>
    </li>
  );
}

export function WhereView() {
  const { data } = useFamily();
  const [tab, setTab] = useState<Tab>("fp");

  const patient = (data ? callName(data.patient) : "a pessoa cuidada");
  const freeMeds = (data?.medications ?? [])
    .filter((m) => m.freeInFarmaciaPopular)
    .map((m) => medLabel(m.name, null));
  const list = pharmacies.slice(0, 6);
  const meds = data?.medications ?? [];
  const ubsMeds = meds.filter((m) => m.freeAt?.includes("ubs")).map((m) => medLabel(m.name, null));
  const highCostMeds = meds.filter((m) => m.highCost);

  return (
    <>
      <PageTitle title="Onde pegar grátis" subtitle={`Perto do endereço de ${patient}`} />

      <Segmented
        label="Tipo de lugar"
        value={tab}
        onChange={setTab}
        options={[
          { value: "fp", label: "Farmácia Popular" },
          { value: "ubs", label: "Posto de saúde" },
        ]}
      />

      {tab === "fp" ? (
        <>
          <PlacesMap places={list} homeLabel={`Casa de ${patient}`} />
          <ul className="overflow-hidden rounded-card border border-line-soft bg-surface">
            {list.map((p, i) => (
              <PharmacyRow key={p.cnes} p={p} index={i} freeMeds={freeMeds} />
            ))}
          </ul>
          <p className="flex items-start gap-2 text-[15px] leading-snug text-muted">
            <InfoIcon size={18} className="mt-0.5 shrink-0" />
            Farmácias credenciadas no Farmácia Popular, segundo o Ministério da Saúde. Leve a
            receita e um documento com foto de {patient}.
          </p>
        </>
      ) : (
        <>
          <PlacesMap places={ubsUnits.slice(0, 3)} homeLabel={`Casa de ${patient}`} />
          <ul className="overflow-hidden rounded-card border border-line-soft bg-surface">
            {ubsUnits.slice(0, 3).map((u, i) => (
              <UnitRow key={u.cnes} u={u} index={i} meds={ubsMeds} />
            ))}
          </ul>
          <p className="flex items-start gap-2 text-[15px] leading-snug text-muted">
            <InfoIcon size={18} className="mt-0.5 shrink-0" />
            A farmácia da UBS entrega grátis os remédios da lista da prefeitura (REMUME). Leve a
            receita e o cartão do SUS de {patient}. O estoque muda: ligue antes.
          </p>
          <section className="flex flex-col gap-2 rounded-card border border-line-soft bg-surface p-4">
            <h2 className="text-[18px] font-extrabold">Farmácia de Alto Custo</h2>
            <p className="text-[15px] leading-snug text-muted">
              Remédios de doenças específicas, entregues pelo Estado. O médico precisa preencher o
              laudo (LME).
              {highCostMeds.length > 0 ? null : " Nenhum remédio desta receita está nessa lista."}
            </p>
            {highCostMeds.map((m) => (
              <Link
                key={m.id}
                href={`/family/alto-custo/${m.id}`}
                className="inline-flex min-h-11 w-fit items-center gap-1.5 text-[15px] font-bold text-brand"
              >
                Ver o caminho de {medLabel(m.name, null)}
                <ChevronRightIcon size={18} />
              </Link>
            ))}
            {highCostUnits[0] ? (
              <span className="text-[15px]">
                Mais perto: <b>{highCostUnits[0].name}</b>, {highCostUnits[0].address} (
                {formatDistance(highCostUnits[0].distanceKm)})
              </span>
            ) : null}
          </section>
        </>
      )}
    </>
  );
}
