import { Suspense } from "react";
import { OpenPatientLink } from "./open-patient-link";

export const metadata = { title: "Recuidado" };

/** The link the family sends to her phone. Keeps the secret on this phone and opens her app. */
export default function PatientLinkPage({ params }: PageProps<"/m/[token]">) {
  return (
    <Suspense fallback={null}>
      <OpenPatientLink params={params} />
    </Suspense>
  );
}
