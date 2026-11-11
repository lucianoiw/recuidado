import { Screen } from "@/components/ui";
import { MedsView } from "./meds-view";

export default function Page() {
  return (
    <Screen audience="family" withNav>
      <MedsView />
    </Screen>
  );
}
