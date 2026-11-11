import type { HTMLAttributes } from "react";
import { cn } from "./cn";

type CardProps = HTMLAttributes<HTMLElement> & {
  tone?: "default" | "danger" | "warn" | "brand";
  as?: "section" | "div" | "article";
};

const tones = {
  default: "bg-surface",
  danger: "border-2 border-danger bg-danger-soft",
  warn: "border-2 border-warn bg-warn-soft",
  brand: "bg-brand-soft",
};

export function Card({ tone = "default", as: Tag = "section", className, ...props }: CardProps) {
  return <Tag className={cn("rounded-card p-4", tones[tone], className)} {...props} />;
}
