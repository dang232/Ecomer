import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/api/client", () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

import { api } from "@/shared/api/client";
import { ApiError } from "@/shared/api/envelope";

import { findOrderByIdempotencyKey, placeOrder } from "@/shared/api/endpoints/orders";

const recipientOnlyOrder = {
  items: [{ productId: "product-1", variantSku: "SKU-1", quantity: 1 }],
  shippingAddress: { street: "1 Main", district: "D1", city: "HCMC" },
  shippingDetails: {
    recipientName: "Buyer One",
    recipientPhone: "+84900000000",
    wardCode: "W1",
    districtCode: "D1",
    provinceCode: "P1",
  },
  paymentMethod: "COD" as const,
};

describe("placeOrder", () => {
  it("sends recipient and address codes without a cart-wide parcel", async () => {
    const order = { id: "order-1", total: 125000 };
    vi.mocked(api.post).mockResolvedValue(order);

    await expect(placeOrder(recipientOnlyOrder, "checkout-key")).resolves.toBe(order);
    expect(api.post).toHaveBeenCalledWith(
      "/orders",
      expect.anything(),
      recipientOnlyOrder,
      { idempotencyKey: "checkout-key" },
    );
    expect(recipientOnlyOrder.shippingDetails).not.toHaveProperty("weightGrams");
    expect(recipientOnlyOrder.shippingDetails).not.toHaveProperty("lengthCm");
    expect(recipientOnlyOrder.shippingDetails).not.toHaveProperty("widthCm");
    expect(recipientOnlyOrder.shippingDetails).not.toHaveProperty("heightCm");
  });
});

describe("findOrderByIdempotencyKey", () => {
  it("uses the reconciliation endpoint and keeps its successful order response", async () => {
    const order = { id: "order-1", total: 125000 };
    vi.mocked(api.get).mockResolvedValue(order);

    await expect(findOrderByIdempotencyKey("checkout-key")).resolves.toEqual({
      kind: "found",
      order,
    });
    expect(api.get).toHaveBeenCalledWith(
      "/orders/by-idempotency-key/checkout-key",
      expect.anything(),
    );
  });

  it("maps the non-enumerating 404 to a typed not-found result", async () => {
    vi.mocked(api.get).mockRejectedValue(new ApiError(404, "NOT_FOUND", "Not found"));

    await expect(findOrderByIdempotencyKey("missing-key")).resolves.toEqual({ kind: "not-found" });
  });

  it("preserves non-404 failures", async () => {
    const failure = new ApiError(500, "UPSTREAM", "Unavailable");
    vi.mocked(api.get).mockRejectedValue(failure);

    await expect(findOrderByIdempotencyKey("checkout-key")).rejects.toBe(failure);
  });
});
