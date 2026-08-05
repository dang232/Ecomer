import { cartSchema, emptyResponseSchema } from "@/shared/contracts/api";
import { api } from "@/shared/api/client";

export const getCart = () => api.get("/cart", cartSchema);

export const addCartItem = (body: { productId: string; quantity: number; variantId?: string }) =>
  api.post("/cart/items", cartSchema, body);

export const mergeCart = (body: {
  sessionId: string;
  idempotencyKey: string;
  items: { productId: string; quantity: number; variantId?: string }[];
}) => api.post("/cart/merge", cartSchema, body, { idempotencyKey: body.idempotencyKey });

export const updateCartItem = (productId: string, body: { quantity: number }) =>
  api.put(`/cart/items/${encodeURIComponent(productId)}`, cartSchema, body);

export const removeCartItem = (productId: string) =>
  api.delete(`/cart/items/${encodeURIComponent(productId)}`, cartSchema);

/**
 * The clear-cart endpoint returns 204 / empty body on success. We don't read the
 * value, just the resolved promise.
 */
export const clearCart = () => api.delete("/cart", emptyResponseSchema);
