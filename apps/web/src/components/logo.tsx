// Luciano's logo file, served unchanged from /public. Never redraw the logo in code.
export function Logo({ width = 178 }: { width?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/logo-recuidado-texto.svg" alt="Recuidado" width={width} height={Math.round((width * 285) / 1816)} style={{ display: "block" }} />;
}
