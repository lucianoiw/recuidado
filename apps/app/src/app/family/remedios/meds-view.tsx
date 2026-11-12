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
  ClockIcon,
  InfoIcon,
  InfoLine,
  PillIcon,
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
  const free = getsFree(m);
  const where = freeWhere(m);
  return (
    <li className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-[0_1px_2px_rgba(22,19,20,0.04)]">
      <button
        type="button"
        onClick={() => onEdit(m)}
        aria-label={`Mudar ${medLabel(m.name, m.strength)}`}
        className="flex min-w-0 flex-col gap-2 text-left"
      >
        <span className="flex items-start gap-3">
          {m.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed R2 link, taken by the family
            <img src={m.photoUrl} alt="" className="h-24 w-16 shrink-0 rounded-2xl bg-cream object-cover" />
          ) : (
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-cream text-muted">
              <CameraIcon size={22} />
            </span>
          )}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[18px] font-semibold leading-snug">{medLabel(m.name, m.strength)}</span>
            <span className="text-[14px] text-muted">
              {m.photoUrl ? "Com foto da caixa no app dela" : "Toque para tirar a foto da caixa"}
            </span>
          </span>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-cream text-muted">
            <PencilIcon size={16} />
          </span>
        </span>
        <span className="flex flex-col gap-1.5 border-t border-line-soft pt-3">
          <InfoLine icon={<ClockIcon />} tone="ink">
            {m.times.length > 0 ? m.times.join(" e ") : "Sem horário definido"}
          </InfoLine>
          {where ? (
            <InfoLine icon={<PinIcon />}>
              Grátis em {where}
            </InfoLine>
          ) : null}
          {m.stock?.low ? (
            <InfoLine icon={<AlertIcon />} tone="warn">
              <b>Acabando:</b> {stockText(m.stock)}
            </InfoLine>
          ) : m.stock ? (
            <InfoLine icon={<PillIcon />}>Em casa: {stockText(m.stock)}</InfoLine>
          ) : m.times.length > 0 ? (
            <InfoLine icon={<PillIcon />}>Quantos tem em casa? Toque para contar.</InfoLine>
          ) : null}
          {free ? (
            m.monthlyCostCents > 0 ? (
              <InfoLine icon={<FreeIcon />} tone="ok">
                Economia de <b>{brl.format(m.monthlyCostCents / 100)}</b> por mês
              </InfoLine>
            ) : null
          ) : (
            <InfoLine icon={<CartIcon />} tone="ink">
              {m.monthlyCostCents > 0 ? (
                <>
                  Até <b>{brl.format(m.monthlyCostCents / 100)}</b> por mês (preço máximo CMED)
                </>
              ) : m.times.length === 0 && m.price ? (
                `Caixa com ${m.price.unitsPerPack}: até ${brl.format(m.price.packCents / 100)} (CMED)`
              ) : (
                "Sem preço ainda"
              )}
            </InfoLine>
          )}
        </span>
      </button>
      {m.highCost ? (
        <Link
          href={`/family/alto-custo/${m.id}`}
          className={`flex items-start justify-between gap-2 rounded-2xl px-3.5 py-3 text-[14px] font-semibold leading-snug no-underline ${
            m.highCostPath?.due ? "bg-warn-soft text-warn" : "bg-cream text-ink"
          }`}
        >
          <span className="flex items-start gap-2">
            <InfoIcon size={17} className="mt-px shrink-0" />
            {m.highCostPath ? pathLine(m.highCostPath) : "Pode ser grátis no Alto Custo, com laudo do médico. Ver o caminho"}
          </span>
          <ChevronRightIcon size={18} className="mt-px shrink-0" />
        </Link>
      ) : null}
      {isFree(m) ? (
        <FreeOrBuy name={m.name} free={free} onChange={(f) => setBuy(m.id, !f)} />
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
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-[24px]">
          <span className="flex size-8 items-center justify-center rounded-full bg-blush text-accent-ink [&>svg]:size-[17px]">
            {icon}
          </span>
          {title}
        </h2>
        <span className="text-[14px] text-muted">{meds.length}</span>
      </div>
      <ul className="flex flex-col gap-3">
        {meds.map((m) => (
          <MedRow key={m.id} m={m} onEdit={onEdit} />
        ))}
      </ul>
      <Link
        href={link.href}
        className="flex items-center justify-between rounded-full bg-ink py-2 pl-2 pr-5 text-white no-underline"
      >
        <span className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-surface text-ink [&>svg]:size-5">
            {icon}
          </span>
          <b className="font-semibold">{link.label}</b>
        </span>
        <ChevronRightIcon size={20} />
      </Link>
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
        <section className="flex flex-col items-center gap-3 rounded-card bg-surface p-6 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-blush text-accent-ink">
            <CameraIcon size={32} />
          </span>
          <b className="text-[19px]">Nenhum remédio ainda</b>
          <p className="text-muted">Adicione pela foto da receita ou um por um.</p>
        </section>
      ) : null}

      {free.length > 0 ? (
        <Group
          icon={<FreeIcon />}
          title="Grátis"
          meds={free}
          link={{ href: "/family/onde-pegar", label: "Ver onde pegar" }}
          onEdit={setEditing}
        />
      ) : null}

      {paid.length > 0 ? (
        <Group
          icon={<CartIcon />}
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
        <InfoLine icon={<PencilIcon />}>Toque em um remédio para mudar a dose, o horário ou parar.</InfoLine>
      ) : null}

      {free.length > 0 ? (
        <InfoLine icon={<InfoIcon />}>
          Para retirar grátis, leve a receita e um documento com foto de {callName(data.patient)}.
        </InfoLine>
      ) : null}
    </>
  );
}
