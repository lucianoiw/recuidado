import Link from "next/link";
import { BellIcon, CameraIcon, FreeIcon, Logo, buttonClass } from "@/components/ui";

const points = [
  { icon: CameraIcon, title: "Foto da receita.", text: "A IA lê e monta os horários." },
  { icon: FreeIcon, title: "O que é grátis.", text: "No Farmácia Popular, perto de casa." },
  { icon: BellIcon, title: "Lembrete e ligação.", text: "Se não confirmar, você fica sabendo." },
];

export default function Welcome() {
  return (
    <>
      <div
        aria-hidden="true"
        className="splash fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-brand text-white"
      >
        <Logo size={112} inverted />
        <p className="text-[40px] font-extrabold tracking-tight">Recuidado</p>
        <p className="text-center text-[19px] leading-snug text-white/90">
          Cuidar de quem
          <br />
          cuidou da gente.
        </p>
      </div>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-7 px-6 pb-8 pt-14">
        <Logo size={56} />
        <div className="flex flex-col gap-2.5">
          <h1 className="text-[32px] font-extrabold leading-[1.12] tracking-tight">
            O remédio de quem você ama, cuidado pela família toda.
          </h1>
          <p className="text-[18px] leading-relaxed text-muted">
            Você cadastra uma vez. A gente lembra na hora certa e avisa vocês se algo ficar para trás.
          </p>
        </div>
        <ul className="flex flex-col gap-4">
          {points.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-center gap-3.5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-brand-soft text-brand">
                <Icon size={24} />
              </span>
              <span className="text-[17px] leading-snug">
                <b>{title}</b> {text}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-auto flex flex-col gap-3">
          <Link href="/comecar" className={buttonClass()}>
            Começar
          </Link>
          <Link href="/family" className={buttonClass({ variant: "secondary" })}>
            Já tenho conta
          </Link>
          <Link href="/patient" className="py-2 text-center text-[15px] font-bold text-brand">
            Abrir o app da Dona Maria
          </Link>
          <p className="text-center text-[13px] text-muted">
            Demonstração com dados fictícios. Não substitui orientação médica.
          </p>
        </div>
      </main>
    </>
  );
}
