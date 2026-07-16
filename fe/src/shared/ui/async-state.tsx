import type { ReactNode } from "react";

import type { AsyncStatus } from "./async-state-model";

interface AsyncStateProps {
  status: AsyncStatus;
  children: ReactNode;
  loading: ReactNode;
  error: ReactNode;
  empty: ReactNode;
  retry?: {
    label: string;
    onClick: () => void;
  };
}

export function AsyncState({ status, children, loading, error, empty, retry }: AsyncStateProps) {
  if (status === "loading") {
    return (
      <div role="status" aria-busy="true" aria-live="polite">
        {loading}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div role="alert" className="flex flex-col items-center gap-4 text-center">
        {error}
        {retry ? (
          <button
            type="button"
            onClick={retry.onClick}
            className="inline-flex min-h-[var(--target-web)] items-center justify-center rounded-[var(--radius-control)] border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {retry.label}
          </button>
        ) : null}
      </div>
    );
  }

  if (status === "empty") {
    return (
      <div role="status" aria-live="polite">
        {empty}
      </div>
    );
  }

  return children;
}
