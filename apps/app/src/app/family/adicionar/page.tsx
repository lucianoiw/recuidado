import Link from "next/link";
import { DemoBannerAuto } from "@/components/demo-banner";
import { CameraIcon, ChevronRightIcon, PencilIcon, Screen, TopBar } from "@/components/ui";

function Option({
  href,
  icon,
  title,
  text,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  text: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3.5 rounded-[22px] border-[1.5px] border-line-soft bg-surface p-[18px] text-ink no-underline hover:border-brand"
    >
      <span className="flex size-[60px] shrink-0 items-center justify-center rounded-[18px] bg-brand-soft text-brand">
        {icon}
      </span>
      <span className="flex flex-1 flex-col gap-1">
        {badge ? (
          <span className="w-fit rounded-full bg-brand-soft px-2.5 py-0.5 text-[12px] font-extrabold tracking-wide text-brand">
            {badge}
          </span>
        ) : null}
        <b className="text-[19px]">{title}</b>
        <span className="text-[15px] leading-snug text-muted">{text}</span>
      </span>
      <ChevronRightIcon size={22} className="text-muted" />
    </Link>
  );
}

export default function AddMedicationsPage() {
  return (
    <Screen audience="family">
      <TopBar backHref="/family" />
      <header className="flex flex-col gap-2">
        <h1 className="text-[28px] font-extrabold leading-tight">Quais remédios ela toma?</h1>
        <p className="text-muted">Escolha como quer adicionar. Dá para misturar os dois.</p>
      </header>
      <DemoBannerAuto />
      <Option
        href="/family/receita"
        icon={<CameraIcon size={30} />}
        title="Foto da receita"
        text="A IA lê os remédios e monta os horários."
        badge="MAIS RÁPIDO"
      />
      <Option
        href="/family/adicionar/um-por-um"
        icon={<PencilIcon size={30} />}
        title="Um por um"
        text="Sem receita em mãos? Digite o nome, a dose e os horários."
      />
      <p className="mt-auto text-center text-[14px] leading-snug text-muted">
        O Recuidado só organiza os horários. Dúvida sobre dose, fale com o médico.
      </p>
    </Screen>
  );
}
