import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * One line of detail with a small icon. The icon stays on the first line
 * when the text wraps.
 */
export function InfoLine({
  icon,
  children,
  tone = "muted",
  className,
}: {
  icon: ReactNode;
  children: ReactNode;
  tone?: "muted" | "ink" | "warn" | "danger" | "ok" | "accent";
  className?: string;
}) {
  const tones = {
    muted: "text-muted",
    ink: "text-ink",
    warn: "text-warn",
    danger: "text-danger",
    ok: "text-ok",
    accent: "text-accent-ink",
  };
  return (
    <span className={cn("flex items-start gap-2 text-[15px] leading-snug", tones[tone], className)}>
      <span className="flex h-[1.375em] shrink-0 items-center [&>svg]:size-[17px]">{icon}</span>
      <span className="min-w-0">{children}</span>
    </span>
  );
}

/**
 * A short notice on a white card: tinted icon on the left, title, text and
 * optional actions. Lighter than a fully colored block.
 */
export function Notice({
  icon,
  tone,
  title,
  children,
  actions,
  role,
}: {
  icon: ReactNode;
  tone: "danger" | "warn" | "accent" | "ok";
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  role?: "alert" | "status";
}) {
  const tones = {
    danger: { chip: "bg-danger-soft text-danger", bar: "before:bg-danger", title: "text-danger" },
    warn: { chip: "bg-warn-soft text-warn", bar: "before:bg-warn", title: "text-warn" },
    accent: { chip: "bg-blush text-accent-ink", bar: "before:bg-accent", title: "text-ink" },
    ok: { chip: "bg-ok-soft text-ok", bar: "before:bg-ok", title: "text-ok" },
  }[tone];
  return (
    <section
      role={role}
      className={cn(
        "relative flex flex-col gap-3 overflow-hidden rounded-card bg-surface p-4 pl-5 shadow-[0_1px_2px_rgba(22,19,20,0.04)]",
        "before:absolute before:inset-y-0 before:left-0 before:w-1",
        tones.bar,
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full [&>svg]:size-5", tones.chip)}>
          {icon}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
          <b className={cn("leading-snug", tones.title)}>{title}</b>
          {children ? <div className="text-[15px] leading-snug text-body">{children}</div> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap gap-2 pl-[52px]">{actions}</div> : null}
    </section>
  );
}

/** Small pill action used inside cards and notices. */
export function pillClass(variant: "dark" | "light" = "light") {
  return cn(
    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-4 text-[15px] font-semibold no-underline transition-colors disabled:opacity-60 [&>svg]:size-[18px]",
    variant === "dark" ? "bg-ink text-white hover:bg-black" : "border border-line bg-surface text-ink hover:border-ink",
  );
}
