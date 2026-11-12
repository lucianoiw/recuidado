"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, CheckIcon, ChevronLeftIcon, PhoneIcon } from "@/components/ui";
import { PageTitle } from "@/components/page-title";
import { cancelPlan, getPlan, startPlanCheckout, type Plan } from "@/lib/api";
import { captureError, track } from "@/lib/analytics";
import { brl } from "@/lib/use-family";

const FREE = ["Leitura da receita com IA", "O que sai grátis no Farmácia Popular", "Preço máximo (CMED) do que precisa comprar", "Divisão do custo entre os filhos com Pix", "Lembrete no celular e botão \"Tomei\""];
const PAID = ["Ligação quando a dose não é confirmada", "Ligação para a família em emergência, e de volta para quem toma o remédio", "Ligação para a farmácia perguntando preço e estoque"];

function dateText(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function PlanView() {
  const paidReturn = useSearchParams().get("pago") === "1";
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    getPlan().then(setPlan, (e) => {
      captureError(e, { screen: "plan" });
      setError("Sem conexão com o servidor.");
    });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Back from the checkout: the webhook may take a few seconds to arrive.
  const waiting = paidReturn && plan !== null && plan.status !== "active";
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(reload, 3000);
    return () => clearInterval(t);
  }, [waiting, reload]);

  async function subscribe() {
    setBusy(true);
    setError(null);
    try {
      track("plan_checkout_clicked");
      window.location.href = await startPlanCheckout();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não deu para abrir o pagamento.");
      setBusy(false);
    }
  }

  async function cancel() {
    if (!window.confirm("Cancelar o plano? As ligações param na hora. O resto continua grátis.")) return;
    setBusy(true);
    try {
      await cancelPlan();
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não deu para cancelar.");
    } finally {
      setBusy(false);
    }
  }

  if (!plan) return <p className="text-muted">{error ?? "Carregando..."}</p>;
  const active = plan.status === "active";
  const price = brl.format(plan.priceCents / 100);

  return (
    <>
      <Link
        href="/family/familia"
        className="flex size-11 items-center justify-center rounded-full border border-line-soft bg-surface"
      >
        <ChevronLeftIcon size={22} />
        <span className="sr-only">Voltar</span>
      </Link>
      <PageTitle title="Plano" subtitle={active ? `${plan.name} ativo` : plan.included ? "Ligações incluídas" : "Plano grátis"} />

      {waiting ? (
        <Card tone="warn">
          <p className="font-semibold">Confirmando o pagamento...</p>
          <p className="text-[15px]">Leva alguns segundos. Pode deixar esta tela aberta.</p>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-3 border border-line-soft bg-surface">
        <h2 className="text-[18px] font-semibold">Grátis, para sempre</h2>
        <ul className="flex flex-col gap-2">
          {FREE.map((f) => (
            <li key={f} className="flex items-start gap-2 text-[16px]">
              <CheckIcon size={20} className="mt-0.5 shrink-0 text-brand" />
              {f}
            </li>
          ))}
        </ul>
      </Card>

      <Card tone={active ? "brand" : "default"} className="flex flex-col gap-3 border border-line-soft">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-blush text-accent-ink">
            <PhoneIcon size={24} />
          </span>
          <div className="flex flex-col">
            <h2 className="text-[18px] font-semibold">{plan.name}</h2>
            <span className="text-[15px] text-muted">
              {price} por mês{plan.trialDays > 0 ? `, ${plan.trialDays} dias grátis` : ""}
            </span>
          </div>
        </div>
        <p className="text-[16px]">Para quem não usa celular: o Recuidado liga.</p>
        <ul className="flex flex-col gap-2">
          {PAID.map((f) => (
            <li key={f} className="flex items-start gap-2 text-[16px]">
              <CheckIcon size={20} className="mt-0.5 shrink-0 text-brand" />
              {f}
            </li>
          ))}
        </ul>

        {plan.included && !active ? (
          <p className="text-[15px] font-semibold">
            {plan.isDemo ? "Ligações ativas na família de demonstração." : "Ligações ativas nesta conta."}
          </p>
        ) : active ? (
          <>
            <p className="text-[15px] font-semibold">
              {plan.trialEndsAt ? `Teste grátis até ${dateText(plan.trialEndsAt)}. Depois, ${price} por mês.` : "Ligações ativas."}
            </p>
            <Button variant="danger-outline" onClick={cancel} disabled={busy}>
              Cancelar plano
            </Button>
          </>
        ) : plan.available ? (
          <>
            <Button onClick={subscribe} disabled={busy}>
              {busy ? "Abrindo pagamento..." : plan.trialDays > 0 ? `Testar ${plan.trialDays} dias grátis` : `Assinar por ${price}`}
            </Button>
            <p className="text-[14px] text-muted">
              Pagamento pela AbacatePay, no cartão. Cancele quando quiser.
              {plan.isDemo ? " Na demonstração é ambiente de teste: nada é cobrado." : ""}
            </p>
          </>
        ) : (
          <p className="rounded-2xl bg-blush p-3.5 text-[15px] font-semibold text-accent-ink">
            Em breve. Por enquanto o Recuidado funciona no plano grátis, sem as ligações.
          </p>
        )}
      </Card>

      {error ? <p className="font-semibold text-danger">{error}</p> : null}
    </>
  );
}
