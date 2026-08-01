import {
  wishlistClearResponseSchema,
  wishlistResponseSchema,
  wishlistToggleResponseSchema,
  type WishlistResponse,
  type WishlistToggleResponse,
} from "../../../types/api";
import { api } from "../client";

export type { WishlistResponse, WishlistToggleResponse };
export { wishlistResponseSchema };

export const getWishlist = () => api.get("/users/me/wishlist", wishlistResponseSchema);

export const addWishlistItem = (productId: string) =>
  api.post("/users/me/wishlist", wishlistToggleResponseSchema, { productId });

export const toggleWishlistItem = (productId: string) =>
  api.post("/users/me/wishlist/toggle", wishlistToggleResponseSchema, { productId });

export const removeWishlistItem = (productId: string) =>
  api.delete(`/users/me/wishlist/${encodeURIComponent(productId)}`, wishlistToggleResponseSchema);

export const clearWishlist = () => api.delete("/users/me/wishlist", wishlistClearResponseSchema);
