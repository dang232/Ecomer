import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

/**
 * Shared test helper: creates a fresh QueryClient with retries disabled
 * and returns it alongside a Wrapper component suitable for renderHook().
 *
 * Usage:
 *   const { Wrapper, client } = makeWrapper();
 *   const { result } = renderHook(() => useMyHook(), { wrapper: Wrapper });
 */
export function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { client, Wrapper };
}
