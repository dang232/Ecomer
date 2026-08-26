import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/api/client", () => ({
  api: {
    delete: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

import { api } from "@/shared/api/client";
import {
  addCartItem,
  clearCart,
  getCart,
  mergeCart,
  removeCartItem,
  updateCartItem,
} from "@/shared/api/endpoints/cart";

describe("cart endpoint characterization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("preserves the cart request methods, paths, bodies, and merge idempotency", async () => {
    vi.mocked(api.get).mockResolvedValue({ items: [] });
    vi.mocked(api.post).mockResolvedValue({ items: [] });
    vi.mocked(api.put).mockResolvedValue({ items: [] });
    vi.mocked(api.delete).mockResolvedValue(undefined);

    await getCart();
    await addCartItem({ productId: "product-1", quantity: 2, variantId: "BLUE-L" });
    await mergeCart({
      sessionId: "session-1",
      idempotencyKey: "merge-key-1",
      items: [{ productId: "product-1", quantity: 2, variantId: "BLUE-L" }],
    });
    await updateCartItem("product-1:BLUE-L", { quantity: 3 });
    await removeCartItem("product-1:BLUE-L");
    await clearCart();

    expect(api.get).toHaveBeenCalledWith("/cart", expect.anything());
    expect(api.post).toHaveBeenNthCalledWith(
      1,
      "/cart/items",
      expect.anything(),
      { productId: "product-1", quantity: 2, variantId: "BLUE-L" },
    );
    expect(api.post).toHaveBeenNthCalledWith(
      2,
      "/cart/merge",
      expect.anything(),
      {
        sessionId: "session-1",
        idempotencyKey: "merge-key-1",
        items: [{ productId: "product-1", quantity: 2, variantId: "BLUE-L" }],
      },
      { idempotencyKey: "merge-key-1" },
    );
    expect(api.put).toHaveBeenCalledWith(
      "/cart/items/product-1%3ABLUE-L",
      expect.anything(),
      { quantity: 3 },
    );
    expect(api.delete).toHaveBeenNthCalledWith(
      1,
      "/cart/items/product-1%3ABLUE-L",
      expect.anything(),
    );
    expect(api.delete).toHaveBeenNthCalledWith(2, "/cart", expect.anything());
  });
});
