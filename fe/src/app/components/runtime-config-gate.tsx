import type { ReactNode } from "react";

import { useAppConfigQuery } from "../hooks/use-app-config";

export function RuntimeConfigGate({ children }: { children: ReactNode }) {
  const config = useAppConfigQuery();

  if (!config.data && config.isPending) {
    return (
      <main
        aria-busy="true"
        aria-label="Loading VNShop"
        className="grid min-h-screen place-items-center bg-background px-6 text-foreground"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </main>
    );
  }

  if (!config.data && config.isError) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
        <section className="max-w-lg text-center" aria-labelledby="maintenance-title">
          <p className="mb-3 text-sm font-semibold text-primary">VNShop</p>
          <h1 id="maintenance-title" className="text-2xl font-semibold">
            Service temporarily unavailable
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            We cannot safely start checkout or sign-in right now. Please try again shortly.
          </p>
        </section>
      </main>
    );
  }

  return children;
}
