import Link from "next/link";
import { BellIcon, CameraIcon, FreeIcon, Logo, buttonClass } from "@/components/ui";
import { SignedInRedirect } from "./signed-in-redirect";

const points = [
  { icon: CameraIcon, title: "Foto da receita.", text: "A IA lê e monta os horários." },
  { icon: FreeIcon, title: "O que é grátis.", text: "No Farmácia Popular, perto de casa." },
  { icon: BellIcon, title: "Lembrete e ligação.", text: "Se não confirmar, você fica sabendo." },
];

export default function Welcome() {
  return (
    <>
      <SignedInRedirect />
      <div
        aria-hidden="true"
        className="splash fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-bg text-ink"
      >
        <Logo size={44} variant="full" />
        <p className="text-center text-[19px] leading-snug text-muted">
          Cuidar de quem
          <br />
          cuidou da gente.
        </p>
      </div>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-7 px-6 pb-8 pt-14">
        <Logo size={32} variant="full" className="self-start" />
        <div className="flex flex-col gap-2.5">
          <h1 className="font-display text-[38px] leading-[1.05]">
            O remédio de quem você ama, cuidado pela família toda.
          </h1>
          <p className="text-[18px] leading-relaxed text-muted">
            Você cadastra uma vez. A gente lembra na hora certa e avisa vocês se algo ficar para trás.
          </p>
        </div>
        <ul className="flex flex-col gap-4">
          {points.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-center gap-3.5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blush text-accent-ink">
                <Icon size={24} />
              </span>
              <span className="text-[17px] leading-snug">
                <b>{title}</b> {text}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-auto flex flex-col gap-3">
          <Link href="/entrar" className={buttonClass()}>
            Começar
          </Link>
          <Link href="/family" className={buttonClass({ variant: "secondary" })}>
            Ver a demonstração
          </Link>
          <Link href="/patient" className="py-2 text-center text-[15px] font-semibold text-ink underline underline-offset-4">
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
