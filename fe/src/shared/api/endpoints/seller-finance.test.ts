import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/api/client", () => ({
  api: {
    post: vi.fn(),
  },
}));

import { api } from "@/shared/api/client";

import { requestPayout } from "@/shared/api/endpoints/seller-finance";

describe("requestPayout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends only amount and currency with the supplied idempotency key", async () => {
    vi.mocked(api.post).mockResolvedValue({} as never);

    await requestPayout({ amount: 125_000, currency: "VND" }, "payout-key-1");

    expect(api.post).toHaveBeenCalledWith(
      "/sellers/me/finance/payouts",
      expect.anything(),
      { amount: 125_000, currency: "VND" },
      { idempotencyKey: "payout-key-1" },
    );
    expect(vi.mocked(api.post).mock.calls[0]?.[2]).not.toHaveProperty("bankAccount");
  });

  it("forwards the same key when a retry repeats the request", async () => {
    vi.mocked(api.post).mockResolvedValue({} as never);
    const body = { amount: 125_000, currency: "VND" } as const;

    await requestPayout(body, "payout-key-reused");
    await requestPayout(body, "payout-key-reused");

    expect(vi.mocked(api.post).mock.calls.map((call) => call[3])).toEqual([
      { idempotencyKey: "payout-key-reused" },
      { idempotencyKey: "payout-key-reused" },
    ]);
  });
});
