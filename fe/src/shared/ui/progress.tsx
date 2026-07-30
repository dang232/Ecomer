import type { HTMLAttributes } from "react";

import { cn } from "../lib/cn";

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  label: string;
}

export function Progress({ value, max = 100, label, className, ...props }: ProgressProps) {
  const safeMax = Math.max(1, max);
  const safeValue = Math.min(Math.max(0, value), safeMax);
  const percentage = (safeValue / safeMax) * 100;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={safeValue}
      className={cn("h-2 overflow-hidden rounded-[var(--radius-round)] bg-muted", className)}
      {...props}
    >
      <div className="h-full bg-primary transition-[width]" style={{ width: `${percentage}%` }} />
    </div>
  );
}
