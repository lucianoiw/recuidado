"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertIcon,
  CameraIcon,
  CartIcon,
  ChevronRightIcon,
  FreeIcon,
  PencilIcon,
  PinIcon,
  PlusIcon,
  buttonClass,
} from "@/components/ui";
import { PageTitle } from "@/components/page-title";
import { EditMedSheet } from "@/components/edit-med-sheet";
import { FreeOrBuy } from "@/components/free-or-buy";
import { callName, isFree, type Medication } from "@/lib/api";
import { useBuyChoice } from "@/lib/buy-choice";
import { formatDistance, pharmacies } from "@/lib/pharmacies";
import { pathLine } from "@/lib/high-cost";
import { stockText } from "@/lib/stock";
import { ubsUnits } from "@/lib/sus-units";
import { brl, medLabel, useFamily } from "@/lib/use-family";

/** Nearest places where it can be free, e.g. "Drogasil, 240 m (Farmácia Popular) ou UBS Sé, 440 m". */
function freeWhere(m: Medication): string | null {
  const fp = m.freeInFarmaciaPopular || m.freeAt?.includes("farmacia_popular");
  const ubs = m.freeAt?.includes("ubs");
  const places: string[] = [];
  const pharmacy = fp ? pharmacies.find((p) => p.fpAccredited) : undefined;
  if (pharmacy) places.push(`${pharmacy.name}, ${formatDistance(pharmacy.distanceKm)} (Farmácia Popular)`);
  else if (fp) places.push("Farmácia Popular");
  const unit = ubs ? ubsUnits[0] : undefined;
  if (unit) places.push(`${unit.name}, ${formatDistance(unit.distanceKm)}`);
  else if (ubs) places.push("UBS");
  return places.length > 0 ? places.join(" ou ") : null;
}

function MedRow({ m, onEdit }: { m: Medication; onEdit: (m: Medication) => void }) {
  const { getsFree, setBuy } = useBuyChoice();
  return (
    <li className="flex flex-col gap-3 border-b border-line-soft px-4 py-3.5 last:border-b-0">
      <button
        type="button"
        onClick={() => onEdit(m)}
        aria-label={`Mudar ${medLabel(m.name, m.strength)}`}
        className="flex min-w-0 flex-col text-left"
      >
        <span className="font-bold">
          {medLabel(m.name, m.strength)}
          <PencilIcon size={16} className="ml-1.5 inline align-[-2px] text-muted" />
        </span>
        <span className="text-[15px] text-muted">
          {m.times.length > 0 ? m.times.join(", ") : "Sem horário definido"}
        </span>
        {freeWhere(m) ? (
          <span className="mt-1 text-[14px] leading-snug text-brand">
            <b>Grátis em:</b> {freeWhere(m)}
          </span>
        ) : null}
        {m.stock?.low ? (
          <span className="flex items-center gap-1.5 text-[15px] font-bold text-warn">
            <AlertIcon size={16} strokeWidth={2.4} className="shrink-0" />
            Acabando: {stockText(m.stock)}
          </span>
        ) : m.stock ? (
          <span className="text-[15px] text-muted">Em casa: {stockText(m.stock)}</span>
        ) : m.times.length > 0 ? (
          <span className="text-[14px] text-muted">Quantos comprimidos tem em casa? Toque para contar.</span>
        ) : null}
        {getsFree(m) ? (
          m.monthlyCostCents > 0 ? (
            <span className="text-[15px] font-bold text-brand">
              Economia de {brl.format(m.monthlyCostCents / 100)} por mês
            </span>
          ) : null
        ) : (
          <span className="text-[15px] font-bold">
            {m.monthlyCostCents > 0
              ? `Até ${brl.format(m.monthlyCostCents / 100)} por mês (preço máximo CMED)`
              : m.times.length === 0 && m.price
                ? `Caixa com ${m.price.unitsPerPack}: até ${brl.format(m.price.packCents / 100)} (CMED)`
                : "Sem preço ainda"}
          </span>
        )}
      </button>
      {m.highCost ? (
        <Link
          href={`/family/alto-custo/${m.id}`}
          className={`flex items-center justify-between gap-2 rounded-xl border-[1.5px] px-3.5 py-2.5 text-[15px] font-bold leading-snug no-underline ${
            m.highCostPath?.due ? "border-warn bg-warn-soft text-warn" : "border-line-soft text-brand"
          }`}
        >
          {m.highCostPath ? pathLine(m.highCostPath) : "Pode ser grátis no Alto Custo, com laudo do médico. Ver o caminho"}
          <ChevronRightIcon size={18} className="shrink-0" />
        </Link>
      ) : null}
      {isFree(m) ? (
        <FreeOrBuy name={m.name} free={getsFree(m)} onChange={(free) => setBuy(m.id, !free)} />
      ) : null}
    </li>
  );
}

function Group({
  icon,
  title,
  meds,
  link,
  onEdit,
}: {
  icon: React.ReactNode;
  title: string;
  meds: Medication[];
  link: { href: string; label: string };
  onEdit: (m: Medication) => void;
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
            <MedRow key={m.id} m={m} onEdit={onEdit} />
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
  const { data, error, reload } = useFamily();
  const { getsFree } = useBuyChoice();
  const [editing, setEditing] = useState<Medication | null>(null);

  if (error) return <p className="text-muted">Sem conexão com o servidor.</p>;
  if (!data) return <p className="text-muted">Carregando...</p>;

  const free = data.medications.filter(getsFree);
  const paid = data.medications.filter((m) => !getsFree(m));

  return (
    <>
      <PageTitle
        title="Remédios"
        subtitle={`${data.medications.length} na receita de ${callName(data.patient)}`}
      />

      {data.medications.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-card border border-line-soft bg-surface p-6 text-center">
          <span className="flex size-16 items-center justify-center rounded-[20px] bg-brand-soft text-brand">
            <CameraIcon size={32} />
          </span>
          <b className="text-[19px]">Nenhum remédio ainda</b>
          <p className="text-muted">Adicione pela foto da receita ou um por um.</p>
        </section>
      ) : null}

      {free.length > 0 ? (
        <Group
          icon={<FreeIcon size={22} className="text-brand" />}
          title="Grátis"
          meds={free}
          link={{ href: "/family/onde-pegar", label: "Ver onde pegar" }}
          onEdit={setEditing}
        />
      ) : null}

      {paid.length > 0 ? (
        <Group
          icon={<CartIcon size={22} className="text-warn" />}
          title="Para comprar"
          meds={paid}
          link={{ href: "/family/comprar", label: "Onde comprar e dividir" }}
          onEdit={setEditing}
        />
      ) : null}

      <EditMedSheet med={editing} onClose={() => setEditing(null)} onSaved={reload} />

      <Link href="/family/adicionar" className={buttonClass()}>
        <PlusIcon size={22} />
        Adicionar remédios
      </Link>

      {data.medications.length > 0 ? (
        <p className="text-[15px] leading-snug text-muted">
          Toque no nome de um remédio para mudar a dose, o horário ou parar. Remédio que não sai grátis fica em Para comprar: toque em Onde comprar e dividir.
        </p>
      ) : null}

      {free.length > 0 ? (
        <p className="flex items-start gap-2 text-[15px] leading-snug text-muted">
          <PinIcon size={18} className="mt-0.5 shrink-0" />
          Para retirar grátis, leve a receita e um documento com foto de {callName(data.patient)}.
        </p>
      ) : null}
    </>
  );
}
