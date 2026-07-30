/**
 * TanStack Query options for the seller-products feature.
 *
 * Note: productListOptions returns ACTIVE catalog products only.
 * Deep-linked editing is supported for an ACTIVE row or a session-recovered draft,
 * NOT for an arbitrary unpublished product ID.
 */

import { queryOptions } from "@tanstack/react-query";

import { productListOptions } from "@/app/hooks/use-products";
import type { Product } from "@/features/catalog";
import { fromServer } from "@/features/catalog";
import {
  sellerProductCreate,
  sellerProductDelete,
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

// ── List options ───────────────────────────────────────────────────────────────

/**
 * Re-export of the shared product list options.
 * The endpoint returns ACTIVE catalog products only.
 */
export { productListOptions };

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
  await sellerProductDelete.mutationFn(id);
  // Caller (or a wrapper) should invalidate the list query.
}

sellerProductDelete.mutationFn = async (id: string): Promise<void> => {
  const { api } = await import("@/shared/api/client");
  await api.delete(`/sellers/me/products/${encodeURIComponent(id)}`);
};

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
