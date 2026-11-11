import { FamilyView } from "./family-view";

export default function FamilyPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 p-6">
      <h1 className="text-2xl font-semibold">Família</h1>
      <div className="mt-6">
        <FamilyView />
      </div>
    </main>
  );
}
