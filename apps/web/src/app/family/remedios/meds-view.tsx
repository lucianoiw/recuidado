"use client";

import Link from "next/link";
import {
  CameraIcon,
  CartIcon,
  ChevronRightIcon,
  GiftIcon,
  PinIcon,
  StatusPill,
  buttonClass,
} from "@/components/ui";
import { PageTitle } from "@/components/page-title";
import type { Medication } from "@/lib/api";
import { brl, medLabel, useFamily } from "@/lib/use-family";

function MedRow({ m }: { m: Medication }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3.5 last:border-b-0">
      <div className="flex min-w-0 flex-col">
        <span className="font-bold">{medLabel(m.name, m.strength)}</span>
        <span className="text-[15px] text-muted">
          {m.times.length > 0 ? m.times.join(", ") : "Sem horário definido"}
        </span>
      </div>
      {m.freeInFarmaciaPopular ? (
        <StatusPill tone="ok">Grátis</StatusPill>
      ) : (
        <span className="whitespace-nowrap font-bold">
          {m.monthlyCostCents > 0 ? `${brl.format(m.monthlyCostCents / 100)}/mês` : "Comprar"}
        </span>
      )}
    </li>
  );
}

function Group({
  icon,
  title,
  meds,
  link,
}: {
  icon: React.ReactNode;
  title: string;
  meds: Medication[];
  link: { href: string; label: string };
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center gap-2 text-[18px] font-extrabold">
        {icon}
        {title}
      </h2>
      <div className="overflow-hidden rounded-card border border-line-soft bg-surface">
        <ul>
          {meds.map((m) => (
            <MedRow key={m.id} m={m} />
          ))}
        </ul>
        <Link
          href={link.href}
          className="flex items-center justify-between border-t border-line-soft bg-[#fbfaf7] px-4 py-3.5 font-bold text-brand no-underline"
        >
          {link.label}
          <ChevronRightIcon size={20} />
        </Link>
      </div>
    </section>
  );
}

export function MedsView() {
  const { data, error } = useFamily();

  if (error) return <p className="text-muted">Sem conexão com o servidor.</p>;
  if (!data) return <p className="text-muted">Carregando...</p>;

  const free = data.medications.filter((m) => m.freeInFarmaciaPopular);
  const paid = data.medications.filter((m) => !m.freeInFarmaciaPopular);

  return (
    <>
      <PageTitle
        title="Remédios"
        subtitle={`${data.medications.length} na receita de ${data.patient.name}`}
      />

      {data.medications.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-card border border-line-soft bg-surface p-6 text-center">
          <span className="flex size-16 items-center justify-center rounded-[20px] bg-brand-soft text-brand">
            <CameraIcon size={32} />
          </span>
          <b className="text-[19px]">Nenhum remédio ainda</b>
          <p className="text-muted">Tire a foto da receita. A IA lê os remédios e os horários.</p>
        </section>
      ) : null}

      {free.length > 0 ? (
        <Group
          icon={<GiftIcon size={22} className="text-brand" />}
          title="Grátis no Farmácia Popular"
          meds={free}
          link={{ href: "/family/onde-pegar", label: "Ver onde pegar" }}
        />
      ) : null}

      {paid.length > 0 ? (
        <Group
          icon={<CartIcon size={22} className="text-warn" />}
          title="Precisa comprar"
          meds={paid}
          link={{ href: "/family/comprar", label: "Ver preços e dividir" }}
        />
      ) : null}

      <Link href="/family/receita" className={buttonClass()}>
        <CameraIcon size={22} />
        {data.medications.length === 0 ? "Foto da receita" : "Receita nova"}
      </Link>

      {free.length > 0 ? (
        <p className="flex items-start gap-2 text-[15px] leading-snug text-muted">
          <PinIcon size={18} className="mt-0.5 shrink-0" />
          Para retirar grátis, leve a receita e um documento com foto de {data.patient.name}.
        </p>
      ) : null}
    </>
  );
}
