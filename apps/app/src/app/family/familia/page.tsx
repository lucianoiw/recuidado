import { Screen } from "@/components/ui";
import { CircleView } from "./circle-view";

export default function Page() {
  return (
    <Screen audience="family" withNav>
      <CircleView />
    </Screen>
  );
}
