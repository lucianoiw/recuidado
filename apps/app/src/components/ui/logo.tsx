import { cn } from "./cn";

/**
 * The Recuidado logo: Luciano's SVG files in /public, used as they are.
 * Never redraw the logo in code. "mark" is the R with the cross; "full" adds
 * the word Recuidado.
 */
export function Logo({
  size = 56,
  variant = "mark",
  className,
}: {
  /** Height in pixels. */
  size?: number;
  variant?: "mark" | "full";
  className?: string;
}) {
  const full = variant === "full";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={full ? "/logo-recuidado-texto.svg" : "/logo-recuidado.svg"}
      alt="Recuidado"
      height={size}
      width={Math.round(size * (full ? 1816 / 285 : 260 / 270))}
      className={cn("shrink-0", className)}
      style={{ height: size, width: "auto" }}
    />
  );
}
