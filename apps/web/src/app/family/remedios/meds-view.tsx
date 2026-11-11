"use client";

import Link from "next/link";
import {
  CameraIcon,
  CartIcon,
  ChevronRightIcon,
  GiftIcon,
  PinIcon,
  PlusIcon,
  buttonClass,
  cn,
} from "@/components/ui";
import { PageTitle } from "@/components/page-title";
import { FreeOrBuy } from "@/components/free-or-buy";
import { callName, isFree, type Medication } from "@/lib/api";
import { useBuyChoice } from "@/lib/buy-choice";
import { brl, medLabel, useFamily } from "@/lib/use-family";

function freeWhere(m: Medication): string | null {
  const fp = m.freeInFarmaciaPopular || m.freeAt?.includes("farmacia_popular");
  const ubs = m.freeAt?.includes("ubs");
  if (fp && ubs) return "No Farmácia Popular ou na UBS";
  if (fp) return "No Farmácia Popular";
  if (ubs) return "Só na UBS";
  return null;
}

function MedRow({ m }: { m: Medication }) {
  const { getsFree, setBuy } = useBuyChoice();
  return (
    <li
      className={cn(
        "flex gap-3 border-b border-line-soft px-4 py-3.5 last:border-b-0",
        isFree(m) ? "flex-col" : "items-center justify-between",
      )}
    >
      <div className="flex min-w-0 flex-col">
        <span className="font-bold">{medLabel(m.name, m.strength)}</span>
        <span className="text-[15px] text-muted">
          {m.times.length > 0 ? m.times.join(", ") : "Sem horário definido"}
        </span>
        {freeWhere(m) ? (
          <span className="text-[14px] font-bold text-brand">{freeWhere(m)}</span>
        ) : null}
        {m.highCost ? (
          <span className="text-[14px] font-bold text-warn">
            Pode ser grátis no Alto Custo, com laudo do médico
          </span>
        ) : null}
      </div>
      {isFree(m) ? (
        <FreeOrBuy name={m.name} free={getsFree(m)} onChange={(free) => setBuy(m.id, !free)} />
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
  const { getsFree } = useBuyChoice();

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
          icon={<GiftIcon size={22} className="text-brand" />}
          title="Grátis"
          meds={free}
          link={{ href: "/family/onde-pegar", label: "Ver onde pegar" }}
        />
      ) : null}

      {paid.length > 0 ? (
        <Group
          icon={<CartIcon size={22} className="text-warn" />}
          title="Para comprar"
          meds={paid}
          link={{ href: "/family/comprar", label: "Ver preços e dividir" }}
        />
      ) : null}

      <Link href="/family/adicionar" className={buttonClass()}>
        <PlusIcon size={22} />
        Adicionar remédios
      </Link>

      {data.medications.some(isFree) ? (
        <p className="text-[15px] leading-snug text-muted">
          Prefere comprar um remédio que sai grátis? Toque em Comprar e ele entra na conta da família.
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
