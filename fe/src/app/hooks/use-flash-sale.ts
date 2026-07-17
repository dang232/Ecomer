import { queryOptions, useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  listActiveFlashSaleCampaigns,
  type ActiveFlashSaleCampaign,
} from "../lib/api/endpoints/flash-sale";

export const flashSaleCampaignsOptions = () =>
  queryOptions<ActiveFlashSaleCampaign[]>({
    queryKey: ["flash-sale", "active"] as const,
    queryFn: () => listActiveFlashSaleCampaigns(),
    staleTime: 60_000,
    retry: false,
  });

/**
 * Active flash-sale campaigns from inventory-service. Public — no auth gate.
 * Refreshed once a minute; the per-product `stockRemaining` is live from Redis.
 */
export function useFlashSaleCampaigns() {
  const query = useQuery(flashSaleCampaignsOptions());

  return {
    campaigns: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}

export interface FlashSaleItem {
  campaign: ActiveFlashSaleCampaign;
}

/**
 * The enriched campaign now carries name + shopName + imageHash + seller badges
 * directly, so no cross-service product join is needed for basic card rendering.
 * Callers that still need full product detail (description, variants, images)
 * should use `useFlashSaleWithFullProducts` instead.
 */
export function useFlashSaleWithProducts() {
  const { campaigns, isLoading, error } = useFlashSaleCampaigns();

  const items = useMemo<FlashSaleItem[]>(
    () => campaigns.map((campaign) => ({ campaign })),
    [campaigns],
  );

  return {
    items,
    isLoading,
    error,
  };
}
