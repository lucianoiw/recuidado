export default function PatientPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 p-6 text-center">
      <div>
        <p className="text-xl text-zinc-600">Hora do remédio</p>
        <h1 className="mt-2 text-4xl font-semibold">Losartana 50 mg</h1>
        <p className="mt-2 text-xl text-zinc-600">1 comprimido</p>
      </div>
      <button
        type="button"
        className="w-full rounded-2xl bg-teal-700 py-8 text-3xl font-semibold text-white active:bg-teal-800"
      >
        Tomei
      </button>
    </main>
  );
}
