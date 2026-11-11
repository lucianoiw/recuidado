import Link from "next/link";
import { HomeIcon, PillIcon } from "@/components/ui";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-[38px] font-bold leading-tight text-brand">Recuidado</h1>
        <p className="text-[20px] text-muted">Cuida do remédio do idoso junto com a família.</p>
      </div>
      <Link
        href="/patient"
        className="flex items-center gap-4 rounded-card border-2 border-line bg-surface p-5 no-underline hover:border-brand"
      >
        <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
          <PillIcon size={36} />
        </span>
        <span className="flex flex-col">
          <span className="text-[24px] font-bold">Sou a Dona Maria</span>
          <span className="text-muted">Ver e confirmar meus remédios.</span>
        </span>
      </Link>
      <Link
        href="/family"
        className="flex items-center gap-4 rounded-card border-2 border-line bg-surface p-5 no-underline hover:border-brand"
      >
        <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
          <HomeIcon size={34} />
        </span>
        <span className="flex flex-col">
          <span className="text-[24px] font-bold">Sou da família</span>
          <span className="text-muted">Doses, alertas e remédios da Dona Maria.</span>
        </span>
      </Link>
      <p className="text-[15px] text-muted">
        Demonstração com dados fictícios. Não substitui orientação médica.
      </p>
    </main>
  );
}
