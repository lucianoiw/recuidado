import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export const inputClass =
  "h-[3.0rem] w-full rounded-[14px] border-[1.5px] border-[#cfc8ba] bg-surface px-3.5 text-[17px] text-ink placeholder:text-[#8c8578] focus:border-brand focus:outline-none aria-invalid:border-danger";

/** A labelled input. Pass `mask` to format the value while typing. */
export function Field({
  label,
  hint,
  mask,
  onValue,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  label: ReactNode;
  hint?: ReactNode;
  mask?: (value: string) => string;
  onValue: (value: string) => void;
}) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <span className="text-[15px] font-semibold">{label}</span>
      <input
        {...props}
        className={inputClass}
        onChange={(e) => onValue(mask ? mask(e.target.value) : e.target.value)}
      />
      {hint ? <span className="text-[14px] text-muted">{hint}</span> : null}
    </label>
  );
}

/** A labelled native select, styled like Field. */
export function SelectField<T extends string>({
  label,
  options,
  value,
  onValue,
  placeholder = "Escolha",
  invalid,
}: {
  label: ReactNode;
  options: readonly T[];
  value: T | null;
  onValue: (value: T) => void;
  placeholder?: string;
  invalid?: boolean;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[15px] font-semibold">{label}</span>
      <span className="relative">
        <select
          className={cn(inputClass, "appearance-none pr-11", !value && "text-[#8c8578]")}
          value={value ?? ""}
          aria-invalid={invalid}
          onChange={(e) => onValue(e.target.value as T)}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    </label>
  );
}
