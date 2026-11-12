import type { ReactNode } from "react";
import styles from "./heading.module.css";

// Thin Inter Tight titles. A section sets --h-size, --h-max and --h-color on its className
// to match the design; phones and tablets use one size for every section.
export function Heading({ level = 2, className, children }: { level?: 1 | 2; className?: string; children: ReactNode }) {
  const Tag = level === 1 ? "h1" : "h2";
  const base = level === 1 ? styles.h1 : styles.h2;
  return <Tag className={className ? `${base} ${className}` : base}>{children}</Tag>;
}
