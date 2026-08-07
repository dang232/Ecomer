import { describe, expect, it } from "vitest";
import { z } from "zod";

import { dashboardRevenueResponseSchema } from "@/shared/api/endpoints/admin";
import {
  adminPayoutSchema,
  adminCursorPageSchema,
  adminPageSchema,
  dashboardRevenuePointSchema,
  dashboardReportSchema,
  dashboardSummarySchema,
  dashboardTopProductSchema,
  dashboardTopSellerSchema,
  disputeStatusSchema,
  sellerSummarySchema,
} from "@/shared/contracts/api/admin";

describe("admin dashboard response contracts", () => {
  it("requires the v2 summary metric names", () => {
    expect(
      dashboardSummarySchema.parse({
        totalOrders: 3,
        paidGmv: 1250000,
        refundedAmount: 100000,
        realizedRevenue: 1150000,
        activeBuyers: 2,
        activeSellers: 1,
        avgPaidOrderValue: 416666.67,
        periodStart: "2026-07-17",
        periodEnd: "2026-07-23",
      }),
    ).toMatchObject({ paidGmv: 1250000, activeBuyers: 2 });
    expect(() => dashboardSummarySchema.parse({ totalRevenue: 1250000 })).toThrow();
  });

  it("accepts the v2 paid GMV revenue point", () => {
    expect(
      dashboardRevenuePointSchema.parse({
        date: "2026-07-22",
        paidGmv: 675875000,
        refundedAmount: 0,
        realizedRevenue: 675875000,
      }),
    ).toEqual({
      date: "2026-07-22",
      paidGmv: 675875000,
      refundedAmount: 0,
      realizedRevenue: 675875000,
    });
  });

  it("unwraps the backend revenue points envelope", () => {
    expect(
      dashboardRevenueResponseSchema.parse({
        points: [
          { date: "2026-07-22", paidGmv: 675875000, refundedAmount: 0, realizedRevenue: 675875000 },
        ],
      }),
    ).toEqual([
      {
        date: "2026-07-22",
        paidGmv: 675875000,
        refundedAmount: 0,
        realizedRevenue: 675875000,
      },
    ]);
  });

  it("keeps product units separate from money", () => {
    expect(
      dashboardTopProductSchema.parse({
        productId: "2b0a8522-4310-4665-9874-bf37a5481667",
        name: "Headphones",
        unitsSold: 230,
      }),
    ).toEqual({
      productId: "2b0a8522-4310-4665-9874-bf37a5481667",
      name: "Headphones",
      unitsSold: 230,
    });
  });

  it("accepts the v2 seller paid GMV contract", () => {
    expect(
      dashboardTopSellerSchema.parse({
        sellerId: "2fa79e15-2e29-4b94-903e-15cc20fe36dc",
        shopName: "Seller",
        paidGmv: 2023315000,
      }),
    ).toEqual({
      sellerId: "2fa79e15-2e29-4b94-903e-15cc20fe36dc",
      shopName: "Seller",
      paidGmv: 2023315000,
    });
  });

  it("accepts one atomic dashboard report snapshot", () => {
    const summary = {
      totalOrders: 3,
      paidGmv: 1250000,
      refundedAmount: 100000,
      realizedRevenue: 1150000,
      activeBuyers: 2,
      activeSellers: 1,
      avgPaidOrderValue: 416666.67,
      periodStart: "2026-07-17",
      periodEnd: "2026-07-23",
    };
    expect(
      dashboardReportSchema.parse({
        asOf: "2026-07-23T12:00:00.000Z",
        periodStart: "2026-07-17",
        periodEnd: "2026-07-23",
        summary,
        revenue: {
          points: [
            {
              date: "2026-07-22",
              paidGmv: 1250000,
              refundedAmount: 100000,
              realizedRevenue: 1150000,
            },
          ],
        },
        topProducts: [],
        topSellers: [],
      }),
    ).toMatchObject({ asOf: "2026-07-23T12:00:00.000Z", summary: { realizedRevenue: 1150000 } });
  });
});

describe("admin cursor pagination contract", () => {
  it("accepts the admin list response shape", () => {
    expect(
      adminCursorPageSchema(z.object({ id: z.string() })).parse({
        items: [{ id: "user-1" }],
        nextCursor: null,
        hasMore: false,
        pageSize: 50,
        sort: { field: "createdAt", direction: "desc" },
        snapshot: { asOf: "2026-08-08T00:00:00Z" },
      }),
    ).toMatchObject({
      items: [{ id: "user-1" }],
      nextCursor: null,
      hasMore: false,
      pageSize: 50,
    });
  });

  it("keeps the legacy admin offset schema available", () => {
    expect(
      adminPageSchema(z.object({ id: z.string() })).parse({
        content: [{ id: "user-1" }],
        number: 0,
        size: 50,
        totalElements: 1,
        totalPages: 1,
      }),
    ).toMatchObject({ content: [{ id: "user-1" }], page: 0, totalPages: 1 });
  });
});

describe("admin seller destination contract", () => {
  it("keeps only masked destination metadata", () => {
    const seller = sellerSummarySchema.parse({
      id: "seller-1",
      shopName: "Alice Shop",
      approved: false,
      destination: {
        destinationId: "destination-1",
        bankName: "Vietcombank",
        last4: "****1234",
        verificationState: "VERIFIED",
      },
      bankAccount: "9704000000000000",
    });

    expect(seller.last4).toBe("****1234");
    expect(seller).not.toHaveProperty("bankAccount");
  });
});

describe("admin payout contract", () => {
  it("accepts a live payout row when sellerName is null", () => {
    expect(
      adminPayoutSchema.parse({
        payoutId: "payout-1",
        sellerId: "2fa79e15-2e29-4b94-903e-15cc20fe36dc",
        sellerName: null,
        amount: 250000,
        status: "PENDING",
        createdAt: "2026-07-29T10:00:00Z",
      }),
    ).toMatchObject({
      id: "payout-1",
      sellerId: "2fa79e15-2e29-4b94-903e-15cc20fe36dc",
      sellerName: null,
      status: "PENDING",
      requestedAt: "2026-07-29T10:00:00Z",
    });
  });
});

describe("admin dispute status", () => {
  it("preserves OPEN verbatim", () => {
    expect(disputeStatusSchema.parse("OPEN")).toBe("OPEN");
  });

  it("preserves RESOLVED verbatim", () => {
    expect(disputeStatusSchema.parse("RESOLVED")).toBe("RESOLVED");
  });

  it("rejects unknown dispute status strings", () => {
    expect(() => disputeStatusSchema.parse("CLOSED")).toThrow();
    expect(() => disputeStatusSchema.parse("")).toThrow();
    expect(() => disputeStatusSchema.parse("open")).toThrow();
  });
});
