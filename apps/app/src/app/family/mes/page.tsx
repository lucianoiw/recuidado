import { Screen } from "@/components/ui";
import { MonthView } from "./month-view";

export default function Page() {
  return (
    <Screen audience="family" withNav>
      <MonthView />
    </Screen>
  );
}
