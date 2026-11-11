import { Screen } from "@/components/ui";
import { WhereView } from "./where-view";

export default function Page() {
  return (
    <Screen audience="family" withNav>
      <WhereView />
    </Screen>
  );
}
