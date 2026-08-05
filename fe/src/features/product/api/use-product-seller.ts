import { useQuery } from "@tanstack/react-query";

import { getSeller } from "@/shared/api/endpoints/sellers";
import type { PublicSeller } from "@/shared/contracts/api";

import type { ProductSellerInput } from "../model/product-view";

export const productSellerQueryKey = (sellerId: string) => ["sellers", "detail", sellerId] as const;

export function useProductSeller(sellerId: string | undefined): ProductSellerInput {
  const query = useQuery<PublicSeller>({
    queryKey: productSellerQueryKey(sellerId ?? "missing"),
    queryFn: () => {
      if (!sellerId) throw new Error("A seller ID is required");
      return getSeller(sellerId);
    },
    enabled: Boolean(sellerId),
    retry: false,
  });

  if (!sellerId) return { status: "unavailable" };
  if (query.isLoading) return { status: "loading" };
  if (query.isError || !query.data) return { status: "unavailable" };

  return { status: "ready", value: query.data };
}
