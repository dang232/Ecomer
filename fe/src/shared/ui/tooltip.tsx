import type { ReactNode } from "react";
import { useId } from "react";

import { cn } from "../lib/cn";

export interface TooltipProps {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Tooltip({ label, children, className }: TooltipProps) {
  const tooltipId = useId();

  return (
    <span className={cn("group relative inline-flex", className)} aria-describedby={tooltipId}>
      {children}
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-56 -translate-x-1/2 rounded-[var(--radius-control)] bg-[var(--utility-strong)] px-2 py-1 text-xs text-[var(--web-on-graphite)] opacity-0 shadow-[var(--shadow-low)] transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}
