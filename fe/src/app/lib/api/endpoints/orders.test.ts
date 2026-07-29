import { describe, expect, it, vi } from "vitest";

vi.mock("../client", () => ({
  api: { get: vi.fn() },
}));

import { api } from "../client";
import { ApiError } from "../envelope";

import { findOrderByIdempotencyKey } from "./orders";

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
