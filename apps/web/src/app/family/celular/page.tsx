import { Screen } from "@/components/ui";
import { PhoneSetupView } from "./phone-setup-view";

export default function Page() {
  return (
    <Screen audience="family">
      <PhoneSetupView />
    </Screen>
  );
}
