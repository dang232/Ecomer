import { z } from "zod";

import { productIdSchema, sellerIdSchema } from "@/shared/contracts/api/branded-ids";
import {
  cursorPageSchema,
  cursorSnapshotSchema,
  cursorSortSchema,
} from "@/shared/contracts/api/shared";

// BE user-service BuyerProfileResponse(keycloakId, email, name, phone, avatarUrl, banned).
// Used by admin user management panel.
export const adminUserSchema = z
  .object({
    keycloakId: z.string(),
    email: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    avatarUrl: z.string().nullable().optional(),
    banned: z.boolean().optional(),
  })
  .passthrough()
  .transform((raw) => ({
    keycloakId: raw.keycloakId,
    email: raw.email ?? undefined,
    name: raw.name ?? undefined,
    phone: raw.phone ?? undefined,
    avatarUrl: raw.avatarUrl ?? undefined,
    banned: raw.banned ?? false,
  }));
export type AdminUser = z.infer<typeof adminUserSchema>;

export function adminPageSchema<T extends z.ZodType>(itemSchema: T) {
  return z
    .object({
      content: z.array(itemSchema).default([]),
      page: z.number().optional(),
      number: z.number().optional(),
      size: z.number().default(50),
      totalElements: z.number().default(0),
      totalPages: z.number().default(0),
    })
    .passthrough()
    .transform((raw) => ({
      content: raw.content,
      page: raw.page ?? raw.number ?? 0,
      size: raw.size,
      totalElements: raw.totalElements,
      totalPages: raw.totalPages,
    }));
}

export type AdminPage<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export function adminCursorPageSchema<T extends z.ZodType>(itemSchema: T) {
  return cursorPageSchema(itemSchema)
    .extend({
      pageSize: z.number().int().min(1).max(100),
      sort: cursorSortSchema,
      snapshot: cursorSnapshotSchema.nullable().optional(),
    })
    .passthrough();
}

export type AdminCursorPage<T> = z.infer<ReturnType<typeof adminCursorPageSchema<z.ZodType<T>>>>;

// BE order-service OrderSummaryProjection(orderId, orderNumber, buyerId,
// sellerId, status, totalAmount, itemCount, createdAt, updatedAt). Used by
// admin order management. IDs remain available for drill-down, while the
// stable order number is the primary operator-facing reference.
export const adminOrderSummarySchema = z
  .object({
    orderId: z.string(),
    orderNumber: z.string().nullable().optional(),
    buyerId: z.string().optional(),
    buyerName: z.string().nullable().optional(),
    sellerId: z.string().nullable().optional(),
    sellerName: z.string().nullable().optional(),
    status: z.string().optional(),
    totalAmount: z.number().nullable().optional(),
    itemCount: z.number().optional(),
    createdAt: z.string().nullable().optional(),
    updatedAt: z.string().nullable().optional(),
  })
  .passthrough()
  .transform((raw) => ({
    orderId: raw.orderId,
    orderNumber: raw.orderNumber ?? undefined,
    buyerId: raw.buyerId ?? "",
    buyerName: raw.buyerName ?? undefined,
    sellerId: raw.sellerId ?? undefined,
    sellerName: raw.sellerName ?? undefined,
    status: raw.status ?? "PENDING_ACCEPTANCE",
    totalAmount: raw.totalAmount ?? 0,
    itemCount: raw.itemCount ?? 0,
    createdAt: raw.createdAt ?? undefined,
    updatedAt: raw.updatedAt ?? undefined,
  }));
export type AdminOrderSummary = z.infer<typeof adminOrderSummarySchema>;

/**
 * Admin / staff-facing schemas backing the admin control plane. The buyer-side
 * coupon surface lives in `./coupon.ts`; this file's couponSchema is the
 * authoritative shape returned by `/admin/coupons`.
 *
 * Each schema accepts both the FE-legacy field names AND the BE wire shape so
 * server-side renames don't crash admin pages. See SESSION-HANDOVER-pt28
 * gotcha #58.
 */

// BE user-service SellerProfileResponse exposes masked destination metadata,
// never a raw account value. Map approved → status string for the UI.
export const sellerSummarySchema = z
  .object({
    id: z.string(),
    shopName: z.string(),
    // Legacy FE-facing fields
    status: z.string().optional(),
    appliedAt: z.string().optional(),
    // Live BE fields
    approved: z.boolean().optional(),
    bankName: z.string().nullable().optional(),
    destination: z
      .object({
        destinationId: z.string().optional(),
        bankName: z.string().nullable().optional(),
        last4: z.string().nullable().optional(),
        verificationState: z.string().optional(),
      })
      .nullable()
      .optional(),
    tier: z.string().optional(),
    vacationMode: z.boolean().optional(),
  })
  .passthrough()
  .transform((raw) => ({
    id: raw.id,
    shopName: raw.shopName,
    status: raw.status ?? (raw.approved ? "APPROVED" : "PENDING"),
    appliedAt: raw.appliedAt,
    approved: raw.approved ?? raw.status === "APPROVED",
    bankName: raw.destination?.bankName ?? raw.bankName,
    last4: raw.destination?.last4,
    destination: raw.destination,
    tier: raw.tier,
    vacationMode: raw.vacationMode,
  }));
export type SellerSummary = z.infer<typeof sellerSummarySchema>;

// BE coupon-service CouponResponse(id: Long, code, type, value: BigDecimal,
// minOrderValue, maxDiscount, maxUses, currentUses, active, validFrom,
// validUntil). FE expected id:string, startsAt/endsAt — aliased.
export const couponSchema = z
  .object({
    // Both id shapes (Long from BE serializes as number)
    id: z.union([z.string(), z.number()]).transform((v) => String(v)),
    code: z.string(),
    type: z.string(),
    value: z.number(),
    minOrderValue: z.number().nullable().optional(),
    maxDiscount: z.number().nullable().optional(),
    maxUses: z.number().optional(),
    currentUses: z.number().optional(),
    // Legacy + live names
    startsAt: z.string().optional(),
    endsAt: z.string().optional(),
    validFrom: z.string().nullable().optional(),
    validUntil: z.string().nullable().optional(),
    active: z.boolean().optional(),
  })
  .passthrough()
  .transform((raw) => ({
    id: raw.id,
    code: raw.code,
    type: raw.type,
    value: raw.value,
    minOrderValue: raw.minOrderValue,
    maxDiscount: raw.maxDiscount,
    maxUses: raw.maxUses,
    currentUses: raw.currentUses,
    startsAt: raw.startsAt ?? raw.validFrom ?? undefined,
    endsAt: raw.endsAt ?? raw.validUntil ?? undefined,
    active: raw.active,
  }));
export type Coupon = z.infer<typeof couponSchema>;

// BE order-service DisputeResponse(disputeId, returnId, buyerReason,
// sellerResponse, adminResolution, resolvedBy, status). FE wanted id,
// description, createdAt — disputeId→id; description is the buyer's reason.

/** Dispute lifecycle status. Distinct from payout status. */
export const disputeStatusSchema = z.enum(["OPEN", "RESOLVED"]);
export type DisputeStatus = z.infer<typeof disputeStatusSchema>;

export const disputeSchema = z
  .object({
    // Legacy
    id: z.string().optional(),
    description: z.string().optional(),
    createdAt: z.string().optional(),
    // Live BE
    disputeId: z.string().optional(),
    buyerReason: z.string().nullable().optional(),
    sellerResponse: z.string().nullable().optional(),
    adminResolution: z.string().nullable().optional(),
    resolvedBy: z.string().nullable().optional(),
    returnId: z.string(),
    status: z.string(),
    orderId: z.string().nullable().optional(),
    orderNumber: z.string().nullable().optional(),
    buyerId: z.string().nullable().optional(),
    buyerName: z.string().nullable().optional(),
    sellerId: z.string().nullable().optional(),
    sellerName: z.string().nullable().optional(),
  })
  .passthrough()
  .transform((raw) => ({
    id: raw.id ?? raw.disputeId ?? "",
    returnId: raw.returnId,
    status: disputeStatusSchema.parse(raw.status),
    description: raw.description ?? raw.buyerReason ?? undefined,
    sellerResponse: raw.sellerResponse ?? undefined,
    adminResolution: raw.adminResolution ?? undefined,
    resolvedBy: raw.resolvedBy ?? undefined,
    createdAt: raw.createdAt,
    orderId: raw.orderId ?? undefined,
    orderNumber: raw.orderNumber ?? undefined,
    buyerId: raw.buyerId ?? undefined,
    buyerName: raw.buyerName ?? undefined,
    sellerId: raw.sellerId ?? undefined,
    sellerName: raw.sellerName ?? undefined,
  }));
export type Dispute = z.infer<typeof disputeSchema>;

// BE seller-finance-service PayoutResponse(payoutId, sellerId, amount, status,
// createdAt, completedBy, createdAt). Same shape as the order-service finance
// projection. Legacy callers expect id + requestedAt; keep accepting both.
// sellerName is joined from the seller-service when the BE supports it (P1-8).

/**
 * All 12 wire statuses from seller-finance-service. Plan 06 Task 4 forbids
 * collapsing PENDING→REQUESTED or COMPLETED→PAID — see
 * `features/admin-payouts/model/payout-view.ts` for the action matrix.
 */
export const payoutStatusSchema = z.enum([
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
]);
export type PayoutStatus = z.infer<typeof payoutStatusSchema>;

export const adminPayoutSchema = z
  .object({
    // Legacy
    id: z.string().optional(),
    requestedAt: z.string().optional(),
    // Live BE
    payoutId: z.string().optional(),
    createdAt: z.string().optional(),
    sellerId: sellerIdSchema,
    sellerName: z.string().nullable().optional(),
    amount: z.number(),
    status: z.string(),
    currency: z.string().optional(),
    // Audit trail (pt35) — populated only on COMPLETED rows. Both nullable
    // because PENDING/FAILED rows have nothing to record, and historical
    // COMPLETED rows that predate the V5 migration have no captured admin.
    completedBy: z.string().nullable().optional(),
    completedAt: z.string().nullable().optional(),
    // Audit trail fields exposed by the BE PayoutResponse:
    idempotencyKey: z.string().nullable().optional(),
    approvedBy: z.string().nullable().optional(),
    paidBy: z.string().nullable().optional(),
    externalReference: z.string().nullable().optional(),
    evidenceReference: z.string().nullable().optional(),
  })
  .passthrough()
  .transform((raw) => ({
    id: raw.id ?? raw.payoutId ?? "",
    sellerId: raw.sellerId,
    sellerName: raw.sellerName,
    amount: raw.amount,
    status: payoutStatusSchema.parse(raw.status),
    requestedAt: raw.requestedAt ?? raw.createdAt,
    completedBy: raw.completedBy ?? undefined,
    completedAt: raw.completedAt ?? undefined,
    idempotencyKey: raw.idempotencyKey ?? undefined,
    approvedBy: raw.approvedBy ?? undefined,
    paidBy: raw.paidBy ?? undefined,
    externalReference: raw.externalReference ?? undefined,
    evidenceReference: raw.evidenceReference ?? undefined,
    currency: raw.currency ?? "VND",
  }));
export type AdminPayout = z.infer<typeof adminPayoutSchema>;

/**
 * Dashboard summary KPIs use the v2 wire contract. `paidGmv` is gross paid
 * value; realized revenue is reduced by idempotent completed refunds.
 */
export const dashboardSummarySchema = z.object({
  totalOrders: z.number(),
  paidGmv: z.number(),
  refundedAmount: z.number(),
  realizedRevenue: z.number(),
  activeBuyers: z.number(),
  activeSellers: z.number(),
  avgPaidOrderValue: z.number(),
  periodStart: z.string(),
  periodEnd: z.string(),
});
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;

export const dashboardRevenuePointSchema = z.object({
  date: z.string(),
  paidGmv: z.number(),
  refundedAmount: z.number(),
  realizedRevenue: z.number(),
});
export type DashboardRevenuePoint = z.infer<typeof dashboardRevenuePointSchema>;

export const dashboardTopProductSchema = z.object({
  productId: productIdSchema,
  name: z.string(),
  unitsSold: z.number(),
});
export type DashboardTopProduct = z.infer<typeof dashboardTopProductSchema>;

export const dashboardTopSellerSchema = z.object({
  sellerId: sellerIdSchema,
  shopName: z.string().nullable(),
  paidGmv: z.number(),
});
export type DashboardTopSeller = z.infer<typeof dashboardTopSellerSchema>;

export const dashboardReportSchema = z.object({
  asOf: z.string().datetime(),
  periodStart: z.string(),
  periodEnd: z.string(),
  summary: dashboardSummarySchema,
  revenue: z.object({ points: z.array(dashboardRevenuePointSchema) }),
  topProducts: z.array(dashboardTopProductSchema),
  topSellers: z.array(dashboardTopSellerSchema),
});
export type DashboardReport = z.infer<typeof dashboardReportSchema>;

/**
 * Video admin — moderation queue & appeals.
 *
 * The appeals queue response maps the Spring Page<VideoModerationResponse> shape.
 * `uploaderName` is not present in the BE response; UI falls back to the i18n
 * "unknownUploader" key when it is absent. `posterUrl` is not returned by the
 * appeals endpoint — it is loaded on-demand via the /preview endpoint.
 */
export const adminVideoModerationQueueItemSchema = z.object({
  videoId: z.string(),
  ownerId: z.string().nullable(),
  productId: z.string().nullable(),
  reviewId: z.string().nullable(),
  stagingKey: z.string().nullable(),
  publicKey: z.string().nullable(),
  status: z.string(),
  rejectionReason: z.string().nullable(),
  moderatedBy: z.string().nullable(),
  moderatedAt: z.string().nullable(),
  publishedAt: z.string().nullable(),
  createdAt: z.string().nullable(),
  nsfwScore: z.number().nullable().optional(),
  posterUrl: z.string().nullable().optional(),
  durationSeconds: z.number().nullable().optional(),
  uploaderName: z.string().nullable().optional(),
});
export type AdminVideoModerationQueueItem = z.infer<typeof adminVideoModerationQueueItemSchema>;

export const adminVideoModerationQueuePageSchema = z.object({
  content: z.array(adminVideoModerationQueueItemSchema).default([]),
  totalElements: z.number().default(0),
  totalPages: z.number().default(0),
  page: z.number().default(0),
  size: z.number().default(20),
});
export type AdminVideoModerationQueuePage = z.infer<typeof adminVideoModerationQueuePageSchema>;

/** Accept the current string response and the normalized object response. */
export const adminVideoPreviewSchema = z
  .union([z.string(), z.object({ url: z.string(), expiresAt: z.string().optional() })])
  .transform((raw) => (typeof raw === "string" ? { url: raw } : raw));
export type AdminVideoPreview = z.infer<typeof adminVideoPreviewSchema>;

export const adminVideoAppealItemSchema = z.object({
  videoId: z.string(),
  status: z.string(),
  rejectionReason: z.string().nullable(),
  appealReason: z.string().nullable(),
  uploaderName: z.string().nullable().optional(),
  createdAt: z.string().nullable(),
  // posterUrl is not in the appeals endpoint response; load via /preview on demand
  posterUrl: z.string().nullable().optional(),
  presignedUrl: z.string().nullable().optional(),
  nsfwScore: z.number().nullable().optional(),
  durationSeconds: z.number().nullable().optional(),
});
export type AdminVideoAppealItem = z.infer<typeof adminVideoAppealItemSchema>;

export const adminVideoModerationResponseSchema = z.object({
  videoId: z.string(),
  status: z.string(),
  rejectionReason: z.string().nullable(),
  moderatedBy: z.string().nullable(),
  moderatedAt: z.string().nullable(),
  publishedAt: z.string().nullable(),
  createdAt: z.string().nullable(),
});
export type AdminVideoModerationResponse = z.infer<typeof adminVideoModerationResponseSchema>;
