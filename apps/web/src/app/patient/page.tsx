import { Screen } from "@/components/ui";
import { PatientView } from "./patient-view";

export default function PatientPage() {
  return (
    <Screen audience="patient">
      <PatientView />
    </Screen>
  );
}
