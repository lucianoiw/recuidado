import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "danger" | "danger-outline";
/** xl: the patient's main action. lg: patient secondary. md: family screens. */
export type ButtonSize = "xl" | "lg" | "md";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-strong active:bg-brand-strong",
  secondary: "bg-surface text-ink",
  danger: "bg-danger text-white hover:bg-danger-strong active:bg-danger-strong",
  "danger-outline": " bg-surface text-danger hover:bg-danger-soft",
};

const sizes: Record<ButtonSize, string> = {
  xl: "min-h-22 rounded-control px-4 text-[28px] gap-2.5",
  lg: "min-h-16 rounded-control px-4 text-[22px] gap-2.5",
  md: "min-h-[56px] rounded-control px-5 text-[17px] gap-2",
};

/** Classes for anything that should look like a button, such as a Link. */
export function buttonClass({
  variant = "primary",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(
    "inline-flex w-full items-center justify-center text-center font-semibold leading-tight no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-60",
    variants[variant],
    // The patient's large buttons keep a strong outline, easier to see for older eyes.
    variant === "secondary" &&
      (size === "md"
        ? "border border-line shadow-[0_1px_2px_rgba(22,19,20,0.05)] hover:border-ink"
        : "border-2 border-ink hover:bg-neutral-soft"),
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
