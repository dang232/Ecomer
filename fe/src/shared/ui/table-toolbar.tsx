import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/cn";

export interface TableToolbarProps extends HTMLAttributes<HTMLDivElement> {
  ariaLabel: string;
  children: ReactNode;
}

export function TableToolbar({ ariaLabel, className, children, ...props }: TableToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label={ariaLabel}
      className={cn(
        "flex min-h-[var(--target-web)] flex-wrap items-center justify-between gap-3",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
