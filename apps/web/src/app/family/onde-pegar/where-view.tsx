"use client";

import { useState } from "react";
import { InfoIcon, NavigationIcon, Segmented, StatusPill } from "@/components/ui";
import { PageTitle } from "@/components/page-title";
import { formatDistance, mapsUrl, pharmacies, type Pharmacy } from "@/lib/pharmacies";
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

export function WhereView() {
  const { data } = useFamily();
  const [tab, setTab] = useState<Tab>("fp");

  const patient = data?.patient.name ?? "a pessoa cuidada";
  const freeMeds = (data?.medications ?? [])
    .filter((m) => m.freeInFarmaciaPopular)
    .map((m) => medLabel(m.name, null));
  const list = pharmacies.slice(0, 6);

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
        <section className="flex flex-col gap-2 rounded-card border border-line-soft bg-surface p-4">
          <b className="text-[18px]">Posto de saúde (UBS)</b>
          <p className="leading-snug text-muted">
            Muitos remédios de uso contínuo também saem grátis na UBS, com receita do SUS. Estamos
            juntando a lista de remédios e de postos da região.
          </p>
          <StatusPill tone="neutral" className="w-fit">
            Em breve
          </StatusPill>
        </section>
      )}
    </>
  );
}
