/**
 * TanStack Query options for the seller-products feature.
 *
 * Note: productListOptions returns ACTIVE catalog products only.
 * Deep-linked editing is supported for an ACTIVE row or a session-recovered draft,
 * NOT for an arbitrary unpublished product ID.
 */

import { queryOptions } from "@tanstack/react-query";

import type { Product } from "@/features/catalog";
import { fromServer } from "@/features/catalog";
import {
  productList,
  sellerProductCreate,
  sellerProductDelete as sellerProductDeleteEndpoint,
  sellerProductPublish,
  sellerProductUpdate,
} from "@/shared/api/endpoints/products";

// ── Query key families ─────────────────────────────────────────────────────────

export const sellerProductKeys = {
  all: ["seller", "products"] as const,
  list: (params: { q?: string; page?: number; size?: number; sellerId?: string }) =>
    [...sellerProductKeys.all, "list", params] as const,
  detail: (id: string) => [...sellerProductKeys.all, "detail", id] as const,
};

export interface ProductListQueryParams {
  sellerId?: string;
  page?: number;
  size?: number;
  categoryId?: string;
  q?: string;
}

// ── List options ───────────────────────────────────────────────────────────────

export const productListOptions = (params: ProductListQueryParams = {}, enabled = true) =>
  queryOptions<Product[]>({
    queryKey: ["catalog", "products", "list", params] as const,
    queryFn: async () => {
      const page = await productList({
        size: params.size ?? 50,
        page: params.page,
        sellerId: params.sellerId,
        categoryId: params.categoryId,
        q: params.q,
      });
      return page.content.map(fromServer);
    },
    enabled,
  });

// ── Detail options ─────────────────────────────────────────────────────────────

export const sellerProductDetailOptions = (id: string) =>
  queryOptions<Product>({
    queryKey: sellerProductKeys.detail(id),
    queryFn: async () => {
      const { productById } = await import("@/shared/api/endpoints/products");
      return fromServer(await productById(id));
    },
    enabled: !!id,
  });

// ── Mutations ─────────────────────────────────────────────────────────────────

/** DELETE /sellers/me/products/{id} — waits for 204, invalidates list. */
export async function sellerProductDelete(id: string): Promise<void> {
  await sellerProductDeleteEndpoint(id);
  // Caller (or a wrapper) should invalidate the list query.
}

/** Create a new product (returns DRAFT). */
export async function sellerProductCreateAction(
  body: Parameters<typeof sellerProductCreate>[0],
): Promise<Product> {
  return fromServer(await sellerProductCreate(body));
}

/** Update an existing product. */
export async function sellerProductUpdateAction(
  id: string,
  body: Parameters<typeof sellerProductUpdate>[1],
): Promise<Product> {
  return fromServer(await sellerProductUpdate(id, body));
}

/** Publish a draft product. */
export async function sellerProductPublishAction(
  id: string,
): Promise<Product> {
  return fromServer(await sellerProductPublish(id));
}
