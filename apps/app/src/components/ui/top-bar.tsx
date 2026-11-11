import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeftIcon } from "./icons";

/** Back button plus optional step progress, used in the family flows. */
export function TopBar({
  backHref,
  onBack,
  step,
  total,
  children,
}: {
  backHref?: string;
  onBack?: () => void;
  step?: number;
  total?: number;
  children?: ReactNode;
}) {
  const back = (
    <>
      <ChevronLeftIcon size={22} />
      <span className="sr-only">Voltar</span>
    </>
  );
  const backClass =
    "flex size-11 shrink-0 items-center justify-center rounded-full border border-line-soft bg-surface text-ink";
  return (
    <div className="flex items-center gap-3.5">
      {onBack ? (
        <button type="button" onClick={onBack} className={backClass}>
          {back}
        </button>
      ) : backHref ? (
        <Link href={backHref} className={backClass}>
          {back}
        </Link>
      ) : null}
      {step && total ? (
        <>
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-line-soft"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={step}
            aria-label={`Passo ${step} de ${total}`}
          >
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(step / total) * 100}%` }} />
          </div>
          <span className="text-[14px] font-bold text-muted">
            {step} de {total}
          </span>
        </>
      ) : (
        <span className="text-[15px] text-muted">{children}</span>
      )}
    </div>
  );
}
