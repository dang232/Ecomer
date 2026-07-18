import { queryOptions, useQuery } from "@tanstack/react-query";

import { productById, productList } from "../lib/api/endpoints/products";
import { fromServer } from "../lib/api/product-mapper";
import type { Product } from "../types/ui";

export interface ProductListQueryParams {
  sellerId?: string;
  page?: number;
  size?: number;
  categoryId?: string;
}

export const productListOptions = (params: ProductListQueryParams = {}, enabled = true) =>
  queryOptions<Product[]>({
    queryKey: ["catalog", "products", "list", params] as const,
    queryFn: async () => {
      const page = await productList({
        size: params.size ?? 50,
        page: params.page,
        sellerId: params.sellerId,
        categoryId: params.categoryId,
      });
      return page.content.map(fromServer);
    },
    enabled,
  });

export const productDetailOptions = (id: string) =>
  queryOptions<Product>({
    queryKey: ["catalog", "products", "detail", id] as const,
    queryFn: async () => fromServer(await productById(id)),
    enabled: !!id,
  });

/**
 * Catalog list. Returns whatever the backend returns — empty arrays included.
 * Errors propagate so callers can render an error state explicitly.
 */
export function useProducts(params: ProductListQueryParams = {}, enabled = true) {
  return useQuery(productListOptions(params, enabled));
}

/** Detail of a single product. */
export function useProduct(id: string) {
  return useQuery(productDetailOptions(id));
}
