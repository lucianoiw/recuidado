import { HeartCheckIcon } from "./icons";
import { cn } from "./cn";

/** The Recuidado mark: a heart with a check, on a rounded tile. */
export function Logo({ size = 56, inverted = false, className }: { size?: number; inverted?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        inverted ? "bg-surface text-brand shadow-lg" : "bg-brand text-white",
        className,
      )}
      style={{ width: size, height: size, borderRadius: size * 0.3 }}
    >
      <HeartCheckIcon size={size * 0.62} strokeWidth={inverted ? 1.9 : 2} />
    </span>
  );
}
