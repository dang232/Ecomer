import { describe, expect, it } from "vitest";

import type { SellerSummary } from "@/shared/contracts/api";

import { toSellerView } from "./seller-view";

describe("toSellerView", () => {
  it("maps approved seller summary to view", () => {
    const raw: SellerSummary = {
      id: "seller-1",
      shopName: "Alice Shop",
      status: "APPROVED",
      appliedAt: "2026-01-10T10:00:00Z",
      approved: true,
      bankName: "Vietcombank",
      last4: "1234",
      destination: null,
      tier: "GOLD",
      vacationMode: false,
    };
    const view = toSellerView(raw);
    expect(view.id).toBe("seller-1");
    expect(view.shopName).toBe("Alice Shop");
    expect(view.approved).toBe(true);
    expect(view.status).toBe("APPROVED");
  });

  it("falls back status to PENDING when neither status nor approved is present", () => {
    const raw = {
      id: "seller-2",
      shopName: "Bob Shop",
    } as unknown as SellerSummary;
    const view = toSellerView(raw);
    expect(view.status).toBe("PENDING");
    expect(view.approved).toBe(false);
    expect(view.bankName).toBeUndefined();
    expect(view.last4).toBeUndefined();
  });

  it("infers approved from legacy status string", () => {
    const raw = {
      id: "seller-3",
      shopName: "Carol Shop",
      status: "APPROVED",
    } as unknown as SellerSummary;
    const view = toSellerView(raw);
    expect(view.approved).toBe(true);
    expect(view.status).toBe("APPROVED");
  });
});
