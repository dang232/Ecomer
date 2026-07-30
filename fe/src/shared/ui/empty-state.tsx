import type { ReactNode } from "react";

import { Button } from "./button";

export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void; variant?: "primary" | "ghost" };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center border border-border bg-card px-6 py-16 text-center"
      role="status"
      aria-label={title}
    >
      <div
        className="mb-4 flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-surface-elevated"
        aria-hidden="true"
      >
        <span className="text-muted-foreground [&>svg]:h-7 [&>svg]:w-7">{icon}</span>
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-80 text-sm text-text-secondary">{description}</p>
      {action ? (
        <Button className="mt-6" variant={action.variant} onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
