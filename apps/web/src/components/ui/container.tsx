import type { ComponentPropsWithoutRef, ElementType } from "react";
import styles from "./container.module.css";

type Props<T extends ElementType> = { as?: T; className?: string } & ComponentPropsWithoutRef<T>;

// Centered page column: 1280 px wide with 64 px gutters on desktop, 16 px on phones.
export function Container<T extends ElementType = "div">({ as, className, ...rest }: Props<T>) {
  const Tag = as ?? "div";
  return <Tag className={className ? `${styles.container} ${className}` : styles.container} {...rest} />;
}
