import { Screen } from "@/components/ui";
import { PatientCallView } from "./patient-call-view";

export default function PatientCallPage() {
  return (
    <Screen audience="patient">
      <PatientCallView />
    </Screen>
  );
}
