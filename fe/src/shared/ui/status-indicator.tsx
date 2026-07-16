import type { HTMLAttributes } from "react";

import { cn } from "../lib/cn";

type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

interface StatusIndicatorProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: StatusTone;
}

const toneClasses: Record<StatusTone, string> = {
  neutral: "bg-muted text-foreground [&_[data-dot]]:bg-muted-foreground",
  info: "bg-info-light text-[var(--color-info-text)] [&_[data-dot]]:bg-info",
  success: "bg-success-light text-[var(--color-success-text)] [&_[data-dot]]:bg-success",
  warning:
    "bg-warning-light text-[var(--color-warning-text)] [&_[data-dot]]:bg-[var(--color-commerce-accent)]",
  danger: "bg-error-light text-[var(--color-danger-text)] [&_[data-dot]]:bg-error",
};

export function StatusIndicator({
  tone = "neutral",
  className,
  children,
  ...props
}: StatusIndicatorProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center gap-2 rounded-[var(--radius-round)] px-2.5 py-1 text-xs font-semibold",
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      <span data-dot className="h-1.5 w-1.5 shrink-0 rounded-full" aria-hidden="true" />
      {children}
    </span>
  );
}
