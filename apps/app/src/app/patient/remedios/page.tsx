import { Screen } from "@/components/ui";
import { PatientMedsView } from "./patient-meds-view";

export default function PatientMedsPage() {
  return (
    <Screen audience="patient">
      <PatientMedsView />
    </Screen>
  );
}
