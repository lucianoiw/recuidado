import type { ReactNode } from "react";
import styles from "./button-link.module.css";

// Pill-shaped link. dark: main action; outline: second action; light: on a dark background.
export function ButtonLink({ href, variant = "dark", children }: { href: string; variant?: "dark" | "outline" | "light"; children: ReactNode }) {
  return (
    <a href={href} className={`${styles.button} ${styles[variant]}`}>
      {children}
    </a>
  );
}
