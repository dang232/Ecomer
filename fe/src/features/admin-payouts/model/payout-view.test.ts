import { describe, expect, it } from "vitest";

import { adminPayoutSchema, type AdminPayout } from "@/shared/contracts/api";
import { sellerIdSchema } from "@/shared/contracts/api/branded-ids";

import { payoutActionsFor, toPayoutView } from "./payout-view";

function payoutFixture(overrides: Partial<AdminPayout> = {}): AdminPayout {
  return {
    id: "p-1",
    sellerId: sellerIdSchema.parse("2fa79e15-2e29-4b94-903e-15cc20fe36dc"),
    sellerName: "Alice Shop",
    amount: 150000,
    currency: "VND",
    status: "REQUESTED",
    requestedAt: "2026-07-22T10:00:00Z",
    completedBy: undefined,
    completedAt: undefined,
    idempotencyKey: undefined,
    approvedBy: undefined,
    paidBy: undefined,
    externalReference: undefined,
    evidenceReference: undefined,
    ...overrides,
  };
}

describe("toPayoutView", () => {
  it("preserves all 12 wire statuses verbatim", () => {
    const wireStatuses = [
      "REQUESTED",
      "APPROVED",
      "SUBMITTING",
      "SUBMITTED",
      "PAID",
      "UNKNOWN",
      "REJECTED",
      "CANCELLED",
      "REVERSED",
      "PENDING",
      "COMPLETED",
      "FAILED",
    ] as const;
    for (const wire of wireStatuses) {
      const view = toPayoutView(payoutFixture({ status: wire }));
      expect(view.status).toBe(wire);
    }
  });

  it("keeps PENDING distinct from REQUESTED", () => {
    expect(toPayoutView(payoutFixture({ status: "PENDING" })).status).toBe("PENDING");
    expect(toPayoutView(payoutFixture({ status: "REQUESTED" })).status).toBe("REQUESTED");
  });

  it("normalizes null sellerName to null", () => {
    const view = toPayoutView(payoutFixture({ sellerName: undefined }));
    expect(view.sellerName).toBeNull();
  });

  it("keeps sellerId available when a parsed payout has sellerName null", () => {
    const parsed = adminPayoutSchema.parse({
      payoutId: "p-1",
      sellerId: "2fa79e15-2e29-4b94-903e-15cc20fe36dc",
      sellerName: null,
      amount: 150000,
      status: "PENDING",
      createdAt: "2026-07-22T10:00:00Z",
    });

    expect(toPayoutView(parsed)).toMatchObject({
      sellerId: "2fa79e15-2e29-4b94-903e-15cc20fe36dc",
      sellerName: null,
      status: "PENDING",
    });
  });
});

describe("payoutActionsFor", () => {
  it("REQUESTED exposes approve + reject", () => {
    expect(payoutActionsFor("REQUESTED")).toMatchObject({
      canApprove: true,
      canReject: true,
      canSubmit: false,
    });
  });

  it("APPROVED exposes only reject (no submit — no BE begin-submission endpoint)", () => {
    expect(payoutActionsFor("APPROVED")).toMatchObject({
      canApprove: false,
      canReject: true,
      canSubmit: false,
    });
  });

  it("SUBMITTING exposes submit + unknown + paid", () => {
    expect(payoutActionsFor("SUBMITTING")).toMatchObject({
      canSubmit: true,
      canUnknown: true,
      canPaid: true,
    });
  });

  it("SUBMITTED exposes unknown + paid (no submit, no self-paid)", () => {
    const a = payoutActionsFor("SUBMITTED");
    expect(a.canSubmit).toBe(false);
    expect(a.canUnknown).toBe(true);
    expect(a.canPaid).toBe(true);
  });

  it("UNKNOWN exposes paid only", () => {
    expect(payoutActionsFor("UNKNOWN")).toMatchObject({
      canPaid: true,
      canSubmit: false,
      canUnknown: false,
    });
  });

  it("PENDING exposes approve + reject + legacy-complete + legacy-fail", () => {
    expect(payoutActionsFor("PENDING")).toMatchObject({
      canApprove: true,
      canReject: true,
      canLegacyComplete: true,
      canLegacyFail: true,
    });
  });

  it("terminal statuses expose no actions", () => {
    for (const status of [
      "PAID",
      "REJECTED",
      "CANCELLED",
      "REVERSED",
      "COMPLETED",
      "FAILED",
    ] as const) {
      const a = payoutActionsFor(status);
      expect(a).toEqual({
        canApprove: false,
        canReject: false,
        canSubmit: false,
        canUnknown: false,
        canPaid: false,
        canLegacyComplete: false,
        canLegacyFail: false,
      });
    }
  });

  it("blocks paid when currentAdminId matches approvedBy (separation of duties)", () => {
    // Self-approver: the admin who approved the payout cannot also mark it paid.
    const a = payoutActionsFor("SUBMITTED", {
      currentAdminId: "admin-self",
      approvedBy: "admin-self",
    });
    expect(a.canPaid).toBe(false);
    expect(a.canUnknown).toBe(true);
  });

  it("allows paid when currentAdminId differs from approvedBy", () => {
    const a = payoutActionsFor("SUBMITTED", {
      currentAdminId: "admin-other",
      approvedBy: "admin-self",
    });
    expect(a.canPaid).toBe(true);
  });

  it("does NOT block paid when approvedBy is missing (no separation signal)", () => {
    // Without an approvedBy audit trail we can't prove self-approval, so we
    // don't block. The BE is the source of truth.
    const a = payoutActionsFor("SUBMITTED", { currentAdminId: "admin-self" });
    expect(a.canPaid).toBe(true);
  });

  it("does NOT block paid when currentAdminId is empty (no session signal)", () => {
    const a = payoutActionsFor("SUBMITTED", { currentAdminId: null, approvedBy: "admin-self" });
    expect(a.canPaid).toBe(true);
  });
});
