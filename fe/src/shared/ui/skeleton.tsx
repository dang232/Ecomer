import type { HTMLAttributes } from "react";

import { cn } from "../lib/cn";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-[var(--radius-control)] bg-surface-elevated motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}
