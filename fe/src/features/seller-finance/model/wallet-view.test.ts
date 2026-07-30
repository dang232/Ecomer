import { describe, expect, it } from "vitest";

import type { Wallet, Payout } from "@/shared/contracts/api/seller-finance";

import { toWalletView } from "./wallet-view";

function makePayout(overrides: Partial<Payout> & Pick<Payout, "id" | "amount" | "status">): Payout {
  return {
    sellerId: undefined,
    requestedAt: "2024-06-01T10:00:00Z",
    completedAt: undefined,
    currency: "VND",
    ...overrides,
  };
}

describe("toWalletView", () => {
  it("separates available balance from active and settled payouts", () => {
    const wallet: Wallet = { balance: 500_000, pending: 75_000 };
    const payouts: Payout[] = [
      makePayout({ id: "p-1", status: "REQUESTED", amount: 100_000 }),
      makePayout({ id: "p-2", status: "PAID", amount: 200_000 }),
    ];

    const view = toWalletView({ wallet, payouts });

    expect(view.availableVnd).toBe(500_000);
    expect(view.pendingBalanceVnd).toBe(75_000);
    expect(view.activePayoutVnd).toBe(100_000);
    expect(view.history.map((h) => h.status)).toEqual(["REQUESTED", "PAID"]);
  });

  it("handles null wallet balance", () => {
    const wallet: Wallet = { balance: null as unknown as number, pending: 0 };
    const payouts: Payout[] = [];

    const view = toWalletView({ wallet, payouts });

    expect(view.availableVnd).toBeNull();
    expect(view.canRequestPayout).toBe(false);
  });

  it("activePayoutVnd sums all active statuses", () => {
    const wallet: Wallet = { balance: 1_000_000, pending: 0 };
    const payouts: Payout[] = [
      makePayout({ id: "p-1", status: "REQUESTED", amount: 50_000 }),
      makePayout({ id: "p-2", status: "APPROVED", amount: 60_000 }),
      makePayout({ id: "p-3", status: "SUBMITTING", amount: 70_000 }),
      makePayout({ id: "p-4", status: "SUBMITTED", amount: 80_000 }),
      makePayout({ id: "p-5", status: "UNKNOWN", amount: 90_000 }),
      makePayout({ id: "p-6", status: "PENDING", amount: 100_000 }),
      makePayout({ id: "p-7", status: "PAID", amount: 200_000 }),
      makePayout({ id: "p-8", status: "FAILED", amount: 30_000 }),
    ];

    const view = toWalletView({ wallet, payouts });

    expect(view.activePayoutVnd).toBe(450_000); // 50+60+70+80+90+100
  });

  it("canRequestPayout is true when balance > 0 and no active payout", () => {
    const wallet: Wallet = { balance: 500_000, pending: 0 };
    const payouts: Payout[] = [
      makePayout({ id: "p-1", status: "PAID", amount: 100_000 }),
    ];

    const view = toWalletView({ wallet, payouts });

    expect(view.canRequestPayout).toBe(true);
  });

  it("canRequestPayout is false when balance is 0", () => {
    const wallet: Wallet = { balance: 0, pending: 0 };
    const payouts: Payout[] = [];

    const view = toWalletView({ wallet, payouts });

    expect(view.canRequestPayout).toBe(false);
  });

  it("canRequestPayout is false when balance is null", () => {
    const wallet: Wallet = { balance: null as unknown as number, pending: 0 };
    const payouts: Payout[] = [];

    const view = toWalletView({ wallet, payouts });

    expect(view.canRequestPayout).toBe(false);
  });

  it("canRequestPayout is false when an active payout is in-flight", () => {
    const wallet: Wallet = { balance: 500_000, pending: 0 };
    const payouts: Payout[] = [
      makePayout({ id: "p-1", status: "REQUESTED", amount: 50_000 }),
    ];

    const view = toWalletView({ wallet, payouts });

    expect(view.canRequestPayout).toBe(false);
  });

  it("maps payout fields correctly", () => {
    const wallet: Wallet = { balance: 100_000, pending: 0 };
    const payouts: Payout[] = [
      makePayout({ id: "p-x", status: "PAID", amount: 50_000, requestedAt: "2024-07-01T00:00:00Z" }),
    ];

    const view = toWalletView({ wallet, payouts });

    const item = view.history[0];
    expect(item.id).toBe("p-x");
    expect(item.amountVnd).toBe(50_000);
    expect(item.status).toBe("PAID");
    expect(item.requestedAt).toBe("2024-07-01T00:00:00Z");
  });
});
