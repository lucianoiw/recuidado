import { PatientView } from "./patient-view";

export default function PatientPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center p-6 text-center">
      <PatientView />
    </main>
  );
}
