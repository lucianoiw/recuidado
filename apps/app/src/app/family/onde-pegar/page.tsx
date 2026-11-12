import { Suspense } from "react";
import { Screen } from "@/components/ui";
import { WhereView } from "./where-view";

export default function Page() {
  return (
    <Screen audience="family" withNav>
      {/* WhereView reads ?tab=ubs|fp, which needs a Suspense boundary. */}
      <Suspense>
        <WhereView />
      </Suspense>
    </Screen>
  );
}
