import type { ReactNode } from "react";
import styles from "./text.module.css";

type Size = "sm" | "md" | "lg" | "xl";

// Body paragraph (17 to 20 px). Color and width can be changed by a section with --p-color
// and --p-max.
export function Text({ size = "lg", className, children }: { size?: Size; className?: string; children: ReactNode }) {
  const cls = `${styles.text} ${styles[size]}${className ? ` ${className}` : ""}`;
  return <p className={cls}>{children}</p>;
}

// Small gray note under a block of text.
export function Fine({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={className ? `${styles.fine} ${className}` : styles.fine}>{children}</p>;
}
