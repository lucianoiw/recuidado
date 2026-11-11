import { Suspense } from "react";
import { Screen } from "@/components/ui";
import { PlanView } from "./plan-view";

export default function Page() {
  return (
    <Screen audience="family">
      <Suspense>
        <PlanView />
      </Suspense>
    </Screen>
  );
}
