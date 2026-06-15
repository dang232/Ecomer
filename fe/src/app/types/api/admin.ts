import { z } from "zod";

import { productIdSchema, sellerIdSchema } from "./branded-ids";

// BE user-service BuyerProfileResponse(keycloakId, name, phone, avatarUrl, banned).
// Used by admin user management panel.
export const adminUserSchema = z
  .object({
    keycloakId: z.string(),
    name: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    avatarUrl: z.string().nullable().optional(),
    banned: z.boolean().optional(),
  })
  .passthrough()
  .transform((raw) => ({
    keycloakId: raw.keycloakId,
    name: raw.name ?? undefined,
    phone: raw.phone ?? undefined,
    avatarUrl: raw.avatarUrl ?? undefined,
    banned: raw.banned ?? false,
  }));
export type AdminUser = z.infer<typeof adminUserSchema>;

// BE order-service OrderSummaryProjection(orderId, buyerId, sellerId, status,
// totalAmount, itemCount, createdAt, updatedAt). Used by admin order management.
export const adminOrderSummarySchema = z
  .object({
    orderId: z.string(),
    buyerId: z.string().optional(),
    sellerId: z.string().nullable().optional(),
    status: z.string().optional(),
    totalAmount: z.number().nullable().optional(),
    itemCount: z.number().optional(),
    createdAt: z.string().nullable().optional(),
    updatedAt: z.string().nullable().optional(),
  })
  .passthrough()
  .transform((raw) => ({
    orderId: raw.orderId,
    buyerId: raw.buyerId ?? "",
    sellerId: raw.sellerId ?? undefined,
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

// BE user-service SellerProfileResponse(id, shopName, bankName, bankAccount,
// approved: boolean, tier, vacationMode). FE wanted `status: string` and
// `appliedAt`; neither exists. Map approved → status string for the UI.
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
    bankAccount: z.string().nullable().optional(),
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
    bankName: raw.bankName,
    bankAccount: raw.bankAccount,
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
  })
  .passthrough()
  .transform((raw) => ({
    id: raw.id ?? raw.disputeId ?? "",
    returnId: raw.returnId,
    status: raw.status,
    description: raw.description ?? raw.buyerReason ?? undefined,
    sellerResponse: raw.sellerResponse ?? undefined,
    adminResolution: raw.adminResolution ?? undefined,
    resolvedBy: raw.resolvedBy ?? undefined,
    createdAt: raw.createdAt,
  }));
export type Dispute = z.infer<typeof disputeSchema>;

// BE seller-finance-service PayoutResponse(payoutId, sellerId, amount, status,
// createdAt, completedBy, createdAt). Same shape as the order-service finance
// projection. Legacy callers expect id + requestedAt; keep accepting both.
export const adminPayoutSchema = z
  .object({
    // Legacy
    id: z.string().optional(),
    requestedAt: z.string().optional(),
    // Live BE
    payoutId: z.string().optional(),
    createdAt: z.string().optional(),
    sellerId: sellerIdSchema,
    amount: z.number(),
    status: z.string(),
    // Audit trail (pt35) — populated only on COMPLETED rows. Both nullable
    // because PENDING/FAILED rows have nothing to record, and historical
    // COMPLETED rows that predate the V5 migration have no captured admin.
    completedBy: z.string().nullable().optional(),
    completedAt: z.string().nullable().optional(),
  })
  .passthrough()
  .transform((raw) => ({
    id: raw.id ?? raw.payoutId ?? "",
    sellerId: raw.sellerId,
    amount: raw.amount,
    status: raw.status,
    requestedAt: raw.requestedAt ?? raw.createdAt,
    completedBy: raw.completedBy ?? undefined,
    completedAt: raw.completedAt ?? undefined,
  }));
export type AdminPayout = z.infer<typeof adminPayoutSchema>;

/**
 * Dashboard summary KPIs. Backend names for the same conceptual KPI vary
 * (`totalRevenue` vs `revenue`). Each field accepts every alias we have seen
 * and the consumer just reads `.totalRevenue`, so the UI no longer needs
 * runtime key probing.
 *
 * NB: order-service DashboardSummaryResponse currently has no totalUsers or
 * totalSellers — those KPIs render as null/em-dash on the dashboard until
 * cross-service aggregation lands. activeBuyers/activeSellers are the actual
 * BE field names; FE doesn't read them yet but we accept them.
 */
export const dashboardSummarySchema = z
  .object({
    totalRevenue: z.number().optional(),
    revenue: z.number().optional(),
    total: z.number().optional(),
    totalUsers: z.number().optional(),
    users: z.number().optional(),
    activeBuyers: z.number().optional(),
    totalOrders: z.number().optional(),
    orders: z.number().optional(),
    totalSellers: z.number().optional(),
    sellers: z.number().optional(),
    activeSellers: z.number().optional(),
    avgOrderValue: z.number().optional(),
    periodStart: z.string().optional(),
    periodEnd: z.string().optional(),
  })
  .passthrough()
  .transform((s) => ({
    totalRevenue: s.totalRevenue ?? s.revenue ?? s.total ?? null,
    totalUsers: s.totalUsers ?? s.users ?? s.activeBuyers ?? null,
    totalOrders: s.totalOrders ?? s.orders ?? null,
    totalSellers: s.totalSellers ?? s.sellers ?? s.activeSellers ?? null,
  }));
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;

export const dashboardRevenuePointSchema = z
  .object({ date: z.string(), amount: z.number() })
  .passthrough();
export type DashboardRevenuePoint = z.infer<typeof dashboardRevenuePointSchema>;

export const dashboardTopProductSchema = z
  .object({ productId: productIdSchema, name: z.string().optional(), revenue: z.number() })
  .passthrough();
export type DashboardTopProduct = z.infer<typeof dashboardTopProductSchema>;

export const dashboardTopSellerSchema = z
  .object({ sellerId: sellerIdSchema, shopName: z.string().optional(), revenue: z.number() })
  .passthrough();
export type DashboardTopSeller = z.infer<typeof dashboardTopSellerSchema>;

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

/** GET /admin/videos/{videoId}/preview — returns the presigned URL string directly. */
export const adminVideoPreviewSchema = z.object({ url: z.string() });
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
