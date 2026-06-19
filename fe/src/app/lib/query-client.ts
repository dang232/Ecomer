import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      // ponytail: fetch-layer retry interceptor owns the 5xx retry budget.
      // Without `retry: false` here, a single useQuery could fan out to
      // 5 (fetch) × 2 (query) = 10 attempts on transient 5xx.
      retry: false,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
