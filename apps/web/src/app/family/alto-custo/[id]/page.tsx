import { Suspense } from "react";
import { Screen } from "@/components/ui";
import { HighCostView } from "./high-cost-view";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Screen audience="family" withNav>
      <Suspense fallback={<p className="text-muted">Carregando...</p>}>
        {params.then(({ id }) => (
          <HighCostView id={id} />
        ))}
      </Suspense>
    </Screen>
  );
}
