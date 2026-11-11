import { Screen } from "@/components/ui";
import { PrescriptionReview } from "./prescription-review";

export default function PrescriptionPage() {
  return (
    <Screen audience="family">
      <PrescriptionReview />
    </Screen>
  );
}
