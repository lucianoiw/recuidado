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
        audience === "patient" ? "gap-5 pb-6 text-[22px]" : "gap-4 pb-6 text-[17px]",
        withNav && "pb-28",
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
        <p className={cn("text-muted", patient ? "text-[22px]" : "text-base")}>{eyebrow}</p>
      ) : null}
      <h1 className={cn("font-bold leading-tight", patient ? "text-[38px]" : "text-[28px]")}>
        {title}
      </h1>
    </header>
  );
}
