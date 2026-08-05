import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";

import { fromServer, type Product } from "@/features/catalog";
import { productList } from "@/shared/api/endpoints/products";
import { getSeller, listSellers } from "@/shared/api/endpoints/sellers";
import type { Page, PublicSeller, PublicSellersPage } from "@/shared/contracts/api";

export const sellerDetailOptions = (id: string | undefined) =>
  queryOptions<PublicSeller>({
    queryKey: ["sellers", "detail", id] as const,
    queryFn: () => {
      if (!id) throw new Error("A seller ID is required");
      return getSeller(id);
    },
    enabled: !!id,
    retry: false,
  });

export const sellerProductsOptions = (sellerId: string | undefined) =>
  queryOptions<Page<Product>>({
    queryKey: ["catalog", "products", { sellerId }] as const,
    queryFn: async () => {
      const page = await productList({ sellerId });
      return { ...page, content: page.content.map(fromServer) };
    },
    enabled: !!sellerId,
    retry: false,
  });

export const sellerShowcaseOptions = () =>
  queryOptions<Page<PublicSeller>>({
    queryKey: ["sellers", "showcase"] as const,
    queryFn: () => listSellers({ page: 0, size: 4 }),
    staleTime: 5 * 60_000,
    retry: false,
  });

export const publicSellersOptions = (page: number) =>
  queryOptions<PublicSellersPage>({
    queryKey: ["sellers", "public", { page }] as const,
    queryFn: () => listSellers({ page, size: 12 }),
    placeholderData: keepPreviousData,
    retry: false,
  });

export function useSellerDetail(id: string | undefined) {
  return useQuery(sellerDetailOptions(id));
}

export function useSellerShowcase() {
  return useQuery(sellerShowcaseOptions());
}

export function usePublicSellers(page: number) {
  return useQuery(publicSellersOptions(page));
}
