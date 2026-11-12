import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * Page container. "patient" uses the large type scale for Dona Maria;
 * "family" is denser. Leaves room at the bottom when a BottomNav is shown.
 */
export function Screen({
  audience,
  withNav = false,
  className,
  children,
}: {
  audience: "patient" | "family";
  withNav?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <main
      className={cn(
        "mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-8",
        audience === "patient" ? "gap-5 pb-6 font-legible text-[22px]" : "gap-4 pb-6 text-[17px]",
        withNav && "pb-[calc(7rem+env(safe-area-inset-bottom))]",
        className,
      )}
    >
      {children}
    </main>
  );
}

export function ScreenHeader({
  eyebrow,
  title,
  audience,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  audience: "patient" | "family";
}) {
  const patient = audience === "patient";
  return (
    <header className="flex flex-col gap-1">
      {eyebrow ? (
        <p className={cn("text-muted", patient ? "text-[22px]" : "text-[15px] font-medium")}>{eyebrow}</p>
      ) : null}
      <h1
        className={cn(
          patient
            ? "text-[38px] font-semibold leading-tight"
            : "font-display text-[34px] leading-[1.05]",
        )}
      >
        {title}
      </h1>
    </header>
  );
}
