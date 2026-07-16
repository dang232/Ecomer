import type { ReactNode } from "react";

import { cn } from "../lib/cn";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, eyebrow, className }: PageHeaderProps) {
  return (
    <header
      className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}
    >
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1 text-sm font-semibold text-primary">{eyebrow}</div> : null}
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{title}</h1>
        {description ? (
          <div className="mt-2 max-w-3xl text-sm text-muted-foreground sm:text-base">
            {description}
          </div>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
