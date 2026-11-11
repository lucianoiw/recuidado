import { Screen } from "@/components/ui";
import { BuyView } from "./buy-view";

export default function Page() {
  return (
    <Screen audience="family" withNav>
      <BuyView />
    </Screen>
  );
}
