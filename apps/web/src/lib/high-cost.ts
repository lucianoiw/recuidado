import type { HighCostStatus } from "./api";

/** "30/11/2026" from "2026-11-30". */
export function formatDay(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Reminder line for the next Alto Custo deadline, e.g. "Entregar o laudo até 30/11/2026 (faltam 19 dias)". */
export function dueText(due: NonNullable<HighCostStatus["due"]>): string {
  const what = due.kind === "lme" ? "Entregar o laudo LME até" : "Renovar o laudo até";
  const left =
    due.daysLeft < 0
      ? `venceu há ${-due.daysLeft} ${-due.daysLeft === 1 ? "dia" : "dias"}`
      : due.daysLeft === 0
        ? "vence hoje"
        : `${due.daysLeft === 1 ? "falta 1 dia" : `faltam ${due.daysLeft} dias`}`;
  return `${what} ${formatDay(due.by)} (${left})`;
}

/** One line for the medication list: the deadline when close, else the checklist progress. */
export function pathLine(status: HighCostStatus): string {
  if (status.due) return dueText(status.due);
  if (status.stage === "renewal") {
    return status.renewBy ? `Recebendo pelo Alto Custo. Renovar até ${formatDay(status.renewBy)}` : "Recebendo pelo Alto Custo";
  }
  return status.done > 0
    ? `Alto Custo: ${status.done} de ${status.total} itens prontos`
    : "Pode ser grátis no Alto Custo, com laudo do médico. Ver o caminho";
}
