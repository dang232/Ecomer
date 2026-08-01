import { describe, expect, it } from "vitest";

import type { Return } from "@/shared/api/endpoints/returns";

import {
  canSellerAct,
  filterReturnsByTab,
  toSellerReturnRow,
} from "./return-queue-view";

function makeReturn(overrides: Partial<Return> & { status: Return["status"] }): Return {
  return {
    returnId: "ret-1",
    id: "ret-1",
    orderId: "ord-1",
    subOrderId: 1,
    buyerId: "b-1",
    reason: "damaged",
    requestedAt: "2026-07-22T00:00:00Z",
    createdAt: "2026-07-22T00:00:00Z",
    resolvedAt: null,
    refundAmount: undefined,
    ...overrides,
  };
}

describe("toSellerReturnRow", () => {
  it("maps REQUESTED status to approve action", () => {
    const row = toSellerReturnRow(makeReturn({ status: "REQUESTED" }));
    expect(row.action).toBe("approve");
  });

  it("maps APPROVED status to complete action", () => {
    const row = toSellerReturnRow(makeReturn({ status: "APPROVED" }));
    expect(row.action).toBe("complete");
  });

  it("maps COMPLETED status to no action", () => {
    const row = toSellerReturnRow(makeReturn({ status: "COMPLETED" }));
    expect(row.action).toBeNull();
  });

  it("maps REJECTED status to no action", () => {
    const row = toSellerReturnRow(makeReturn({ status: "REJECTED" }));
    expect(row.action).toBeNull();
  });

  it("maps id, orderId, reason, status, and requestedAt", () => {
    const ret = makeReturn({ status: "REQUESTED", reason: "wrong_item" });
    const row = toSellerReturnRow(ret);
    expect(row.id).toBe("ret-1");
    expect(row.orderId).toBe("ord-1");
    expect(row.reason).toBe("wrong_item");
    expect(row.status).toBe("REQUESTED");
    expect(row.requestedAt).toBe("2026-07-22T00:00:00Z");
  });
});

describe("canSellerAct", () => {
  it("returns approve for REQUESTED", () => {
    expect(canSellerAct("REQUESTED")).toBe("approve");
  });

  it("returns complete for APPROVED", () => {
    expect(canSellerAct("APPROVED")).toBe("complete");
  });

  it("returns null for COMPLETED", () => {
    expect(canSellerAct("COMPLETED")).toBeNull();
  });

  it("returns null for REJECTED", () => {
    expect(canSellerAct("REJECTED")).toBeNull();
  });
});

describe("filterReturnsByTab", () => {
  const returns: Return[] = [
    makeReturn({ returnId: "r1", status: "REQUESTED" }),
    makeReturn({ returnId: "r2", status: "APPROVED" }),
    makeReturn({ returnId: "r3", status: "COMPLETED" }),
    makeReturn({ returnId: "r4", status: "REJECTED" }),
    makeReturn({ returnId: "r5", status: "REQUESTED" }),
  ];

  it("returns only REQUESTED for 'requested' tab", () => {
    const filtered = filterReturnsByTab(returns, "requested");
    expect(filtered.map((r) => r.returnId)).toEqual(["r1", "r5"]);
  });

  it("returns only APPROVED for 'approved' tab", () => {
    const filtered = filterReturnsByTab(returns, "approved");
    expect(filtered.map((r) => r.returnId)).toEqual(["r2"]);
  });

  it("returns only COMPLETED for 'completed' tab", () => {
    const filtered = filterReturnsByTab(returns, "completed");
    expect(filtered.map((r) => r.returnId)).toEqual(["r3"]);
  });

  it("returns only REJECTED for 'rejected' tab", () => {
    const filtered = filterReturnsByTab(returns, "rejected");
    expect(filtered.map((r) => r.returnId)).toEqual(["r4"]);
  });
});
