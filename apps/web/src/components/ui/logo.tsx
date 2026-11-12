/* eslint-disable @next/next/no-img-element -- SVG file, nothing to optimize */
// Luciano's logo file, served unchanged from /public. Never redraw the logo in code.
export function Logo({ width = 178, className }: { width?: number; className?: string }) {
  return <img src="/logo-recuidado-texto.svg" alt="Recuidado" width={width} height={Math.round((width * 285) / 1816)} className={className} />;
}
