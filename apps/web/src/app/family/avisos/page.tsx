import { Screen } from "@/components/ui";
import { AlertsView } from "./alerts-view";

export default function Page() {
  return (
    <Screen audience="family" withNav>
      <AlertsView />
    </Screen>
  );
}
