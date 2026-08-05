import type { HTMLAttributes } from "react";

import { cn } from "../lib/cn";

export interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {
  density?: "standard" | "compact";
}

export function PageContainer({ density = "standard", className, ...props }: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8",
        density === "compact" ? "py-4" : "py-6",
        className,
      )}
      {...props}
    />
  );
}
