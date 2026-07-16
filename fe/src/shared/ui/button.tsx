import { LoaderCircle } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "../lib/cn";

export type ButtonVariant = "primary" | "accent" | "outline" | "ghost" | "success" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pending?: boolean;
  pendingLabel?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-primary text-primary-foreground shadow-[var(--shadow-xs)] hover:bg-primary-hover",
  accent:
    "border-transparent bg-accent text-accent-foreground shadow-[var(--shadow-xs)] hover:brightness-95",
  outline: "border-border bg-card text-foreground hover:bg-muted",
  ghost: "border-transparent bg-transparent text-foreground hover:bg-muted",
  success:
    "border-transparent bg-success text-[var(--color-on-success)] shadow-[var(--shadow-xs)] hover:brightness-90",
  danger:
    "border-transparent bg-error text-destructive-foreground shadow-[var(--shadow-xs)] hover:brightness-90",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-[var(--target-web)] px-3 py-2 text-sm",
  md: "min-h-[var(--target-web)] px-4 py-2.5 text-sm",
  lg: "min-h-12 px-5 py-3 text-base",
  icon: "min-h-[var(--target-web)] min-w-[var(--target-web)] p-2.5",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    type = "button",
    variant = "primary",
    size = "md",
    pending = false,
    pendingLabel = "Working",
    disabled,
    className,
    children,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] border font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {pending ? (
        <>
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>{pendingLabel}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
});
