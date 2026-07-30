import { type InputHTMLAttributes, type ReactNode, useId } from "react";

import { cn } from "../lib/cn";

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
  description?: ReactNode;
}

export function Switch({ id, label, description, className, disabled, ...props }: SwitchProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <label
      htmlFor={inputId}
      className={cn(
        "flex min-h-[var(--target-web)] cursor-pointer items-start justify-between gap-4 text-sm text-foreground",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <span className="grid gap-1">
        <span className="font-medium">{label}</span>
        {description ? <span className="text-xs text-muted-foreground">{description}</span> : null}
      </span>
      <span className="relative mt-0.5 inline-flex h-6 w-11 shrink-0">
        <input
          id={inputId}
          type="checkbox"
          role="switch"
          disabled={disabled}
          className="peer sr-only"
          {...props}
        />
        <span
          aria-hidden="true"
          className="h-full w-full rounded-full bg-switch-background transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-card shadow-[var(--shadow-low)] transition-transform peer-checked:translate-x-5"
        />
      </span>
    </label>
  );
}
