import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold text-teal-700">Recuidado</h1>
        <p className="mt-2 text-zinc-600">
          Cuida do remédio do idoso junto com a família.
        </p>
      </div>
      <Link
        href="/family"
        className="rounded-xl border border-zinc-200 p-5 hover:border-teal-600"
      >
        <span className="block text-lg font-medium">Sou da família</span>
        <span className="text-sm text-zinc-600">
          Remédios, custos e doses da Dona Maria.
        </span>
      </Link>
      <Link
        href="/patient"
        className="rounded-xl border border-zinc-200 p-5 hover:border-teal-600"
      >
        <span className="block text-lg font-medium">Sou a Dona Maria</span>
        <span className="text-sm text-zinc-600">Ver e confirmar meus remédios.</span>
      </Link>
      <p className="text-xs text-zinc-500">
        Demonstração com dados fictícios. Não substitui orientação médica.
      </p>
    </main>
  );
}
