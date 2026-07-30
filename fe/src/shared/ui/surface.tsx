import type { HTMLAttributes } from "react";

import { cn } from "../lib/cn";

export interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  tone?: "default" | "subtle" | "raised";
  padding?: "none" | "sm" | "md" | "lg";
}

const toneClasses = {
  default: "bg-card",
  subtle: "bg-muted",
  raised: "bg-card shadow-[var(--shadow-medium)]",
};

const paddingClasses = {
  none: "p-0",
  sm: "p-3",
  md: "p-4 sm:p-5",
  lg: "p-5 sm:p-6",
};

export function Surface({ tone = "default", padding = "md", className, ...props }: SurfaceProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-border",
        toneClasses[tone],
        paddingClasses[padding],
        className,
      )}
      {...props}
    />
  );
}
