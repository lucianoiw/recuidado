import type { HTMLAttributes } from "react";
import { cn } from "./cn";

type CardProps = HTMLAttributes<HTMLElement> & {
  tone?: "default" | "danger" | "warn" | "brand";
  as?: "section" | "div" | "article";
};

const tones = {
  default: "bg-surface shadow-[0_1px_2px_rgba(22,19,20,0.04)]",
  danger: " bg-danger-soft",
  warn: " bg-warn-soft",
  brand: "bg-blush",
};

export function Card({ tone = "default", as: Tag = "section", className, ...props }: CardProps) {
  return <Tag className={cn("rounded-card p-5", tones[tone], className)} {...props} />;
}
