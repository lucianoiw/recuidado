import { Screen } from "@/components/ui";
import { DemoView } from "./demo-view";

export default function DemoPage() {
  return (
    <Screen audience="family" withNav>
      <DemoView />
    </Screen>
  );
}
