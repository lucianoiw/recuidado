import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "danger" | "danger-outline";
/** xl: the patient's main action. lg: patient secondary. md: family screens. */
export type ButtonSize = "xl" | "lg" | "md";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-strong active:bg-brand-strong",
  secondary: "border-2 border-ink bg-surface text-ink hover:bg-neutral-soft",
  danger: "bg-danger text-white hover:bg-danger-strong active:bg-danger-strong",
  "danger-outline": "border-2 border-danger bg-surface text-danger hover:bg-danger-soft",
};

const sizes: Record<ButtonSize, string> = {
  xl: "min-h-22 rounded-control px-3 text-[28px] gap-2.5",
  lg: "min-h-16 rounded-control px-5 text-2xl gap-3",
  md: "min-h-[56px] rounded-2xl px-4 text-[18px] gap-2",
};

/** Classes for anything that should look like a button, such as a Link. */
export function buttonClass({
  variant = "primary",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(
    "inline-flex w-full items-center justify-center text-center font-bold leading-tight no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-60",
    variants[variant],
    sizes[size],
    className,
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClass({ variant, size, className })} {...props} />;
}
