import { queryOptions, useQuery } from "@tanstack/react-query";

import { useAuth } from "@/app/hooks/auth-context";
import { sellerRevenue, type SellerRevenuePoint } from "@/shared/api/endpoints/seller-analytics";

export const sellerRevenueOptions = (days: number) =>
  queryOptions<SellerRevenuePoint[]>({
    queryKey: ["seller", "revenue", { days }] as const,
    queryFn: () => sellerRevenue({ days }),
    staleTime: 60_000,
    retry: false,
  });

interface UseSellerRevenueOptions {
  days?: number;
}

/**
 * Daily revenue + order-count for the current seller. Gated on the SELLER
 * realm role so anonymous or buyer-only sessions never trigger the request.
 */
export function useSellerRevenue({ days = 30 }: UseSellerRevenueOptions = {}) {
  const { ready, authenticated, roles } = useAuth();
  const enabled = ready && authenticated && roles.includes("SELLER");

  const query = useQuery({ ...sellerRevenueOptions(days), enabled });

  return {
    points: query.data ?? [],
    isLoading: query.isLoading && enabled,
    error: query.error,
  };
}