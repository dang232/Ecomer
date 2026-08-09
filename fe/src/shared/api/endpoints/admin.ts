import { z } from "zod";

import { api } from "@/shared/api/client";
import type { COUPON_TYPES } from "@/shared/contracts";
import {
  adminCursorPageSchema,
  adminOrderSummarySchema,
  adminPageSchema,
  adminPayoutSchema,
  adminUserSchema,
  adminVideoAppealItemSchema,
  adminVideoModerationQueueItemSchema,
  adminVideoModerationQueuePageSchema,
  adminVideoModerationResponseSchema,
  adminVideoPreviewSchema,
  couponSchema,
  dashboardRevenuePointSchema,
  dashboardReportSchema,
  dashboardSummarySchema,
  dashboardTopProductSchema,
  dashboardTopSellerSchema,
  disputeSchema,
  reviewSchema,
  sellerSummarySchema,
  type DashboardSummary,
} from "@/shared/contracts/api";

export type { DashboardSummary };

export type AdminCursorParams = {
  limit?: number;
  cursor?: string;
};

export type AdminFilteredCursorParams = AdminCursorParams & {
  q?: string;
};

export type AdminOrderCursorParams = AdminFilteredCursorParams & {
  status?: string;
};

export type AdminPayoutCursorParams = AdminFilteredCursorParams & {
  status?: string;
};

// User management
export const adminSearchUsers = (params: { q?: string; page?: number; size?: number } = {}) =>
  api.get("/admin/users", adminPageSchema(adminUserSchema), {
    q: params.q,
    page: params.page ?? 0,
    size: params.size ?? 50,
  });

export const adminListUsers = adminSearchUsers;

export const adminSearchUsersCursor = (params: AdminFilteredCursorParams = {}) =>
  api.get("/admin/users", adminCursorPageSchema(adminUserSchema), {
    q: params.q,
    limit: params.limit ?? 50,
    cursor: params.cursor,
  });

export const adminBanUser = (id: string) =>
  api.post(`/admin/users/${encodeURIComponent(id)}/ban`, adminUserSchema);
export const adminUnbanUser = (id: string) =>
  api.post(`/admin/users/${encodeURIComponent(id)}/unban`, adminUserSchema);
export const adminUserOrders = (buyerId: string) =>
  api.get(
    `/admin/orders/by-buyer/${encodeURIComponent(buyerId)}`,
    z.array(adminOrderSummarySchema),
  );

// Order management
export const adminListOrders = (
  params: { q?: string; status?: string; page?: number; size?: number } = {},
) => api.get("/admin/orders", adminPageSchema(adminOrderSummarySchema), params);

export const adminListOrdersCursor = (params: AdminOrderCursorParams = {}) =>
  api.get("/admin/orders", adminCursorPageSchema(adminOrderSummarySchema), {
    q: params.q,
    status: params.status,
    limit: params.limit ?? 50,
    cursor: params.cursor,
  });

export const adminCancelOrder = (id: string) =>
  api.post(`/admin/orders/${encodeURIComponent(id)}/cancel`, z.unknown());
export const adminRefundOrder = (id: string, reason: string) =>
  api.post(
    `/admin/orders/${encodeURIComponent(id)}/refund`,
    z.object({ orderId: z.string(), returnIds: z.array(z.string()) }),
    { reason },
  );
export const adminChangeOrderStatus = (id: string, status: string) =>
  api.patch(`/admin/orders/${encodeURIComponent(id)}/status`, z.unknown(), { status });

export const adminListSellers = (params: { q?: string } = {}) =>
  api.get("/admin/sellers", z.array(sellerSummarySchema), params);

export const adminListSellersCursor = (params: AdminFilteredCursorParams = {}) =>
  api.get("/admin/sellers", adminCursorPageSchema(sellerSummarySchema), {
    q: params.q,
    limit: params.limit ?? 50,
    cursor: params.cursor,
  });

export const adminApproveSeller = (id: string) =>
  api.post(`/admin/sellers/${encodeURIComponent(id)}/approve`, sellerSummarySchema);
export const adminRejectSeller = (id: string, body: { reason: string }) =>
  api.post(`/admin/sellers/${encodeURIComponent(id)}/reject`, sellerSummarySchema, body);

export const adminPendingReviews = (params: { q?: string } = {}) =>
  api.get("/admin/reviews/pending", z.array(reviewSchema), params);

export const adminPendingReviewsCursor = (params: AdminFilteredCursorParams = {}) =>
  api.get("/admin/reviews/pending", adminCursorPageSchema(reviewSchema), {
    q: params.q,
    limit: params.limit ?? 50,
    cursor: params.cursor,
  });

export const adminApproveReview = (id: string) =>
  api.put(`/admin/reviews/${encodeURIComponent(id)}/approve`, reviewSchema);
export const adminRejectReview = (id: string, body: { reason: string }) =>
  api.put(`/admin/reviews/${encodeURIComponent(id)}/reject`, reviewSchema, body);

export interface CouponWriteBody {
  code: string;
  type: (typeof COUPON_TYPES)[number];
  value: number;
  minOrderValue?: number;
  maxDiscount?: number;
  /** BE CreateCouponRequest requires this as a primitive int. Send a
   *  positive integer; the dialog defaults to 1000 if no field surfaces
   *  it to the admin. */
  maxUses: number;
  /** BE CreateCouponRequest requires this as an Instant. ISO-8601 string. */
  validUntil: string;
  startsAt?: string;
  endsAt?: string;
  active?: boolean;
}

export const adminListCoupons = () => api.get("/admin/coupons", z.array(couponSchema));
export const adminCreateCoupon = (body: CouponWriteBody) =>
  api.post("/admin/coupons", couponSchema, body);
export const adminUpdateCoupon = (id: string, body: CouponWriteBody) =>
  api.put(`/admin/coupons/${encodeURIComponent(id)}`, couponSchema, body);
export const adminDeactivateCoupon = (id: string) =>
  api.post(`/admin/coupons/${encodeURIComponent(id)}/deactivate`, couponSchema);

export const adminOpenDisputes = (params: { q?: string } = {}) =>
  api.get("/admin/disputes/open", z.array(disputeSchema), params);

export const adminOpenDisputesCursor = (params: AdminFilteredCursorParams = {}) =>
  api.get("/admin/disputes/open", adminCursorPageSchema(disputeSchema), {
    q: params.q,
    limit: params.limit ?? 50,
    cursor: params.cursor,
  });

export const adminResolveDispute = (id: string, body: { adminResolution: string }) =>
  api.post(`/admin/disputes/${encodeURIComponent(id)}/resolve`, disputeSchema, body);

export const adminPendingPayouts = (params: { q?: string } = {}) =>
  api.get("/admin/finance/payouts/pending", z.array(adminPayoutSchema), params);
export const adminCompletedPayouts = (params: { q?: string } = {}) =>
  api.get("/admin/finance/payouts/completed", z.array(adminPayoutSchema), params);
export type PayoutActionBody = {
  reason: string;
  evidence?: {
    externalReference?: string;
    evidenceHash?: string;
    maskedDestinationConfirmed?: boolean;
  };
};
export const adminCompletePayout = (id: string, body?: PayoutActionBody) =>
  api.post(`/admin/finance/payouts/${encodeURIComponent(id)}/complete`, adminPayoutSchema, body);
export const adminFailPayout = (id: string, body: PayoutActionBody) =>
  api.post(`/admin/finance/payouts/${encodeURIComponent(id)}/fail`, adminPayoutSchema, body);

/**
 * Plan 06 Task 4 — V5 payout action surface. Each endpoint mirrors the
 * controller signature in seller-finance-service's AdminFinanceController:
 * approve/reject/unknown/paid/submit use `@RequestParam`; complete/fail take
 * the nested `PayoutActionRequest` body; the legacy `pending`/`completed`
 * `*Payouts` endpoints above stay for the order-service finance projection
 * that's still mounted at the same paths.
 */

export const adminAllPayouts = (
  params: {
    status?: string;
    page?: number;
    size?: number;
    q?: string;
  } = {},
) =>
  api.get("/admin/finance/payouts", adminPageSchema(adminPayoutSchema), {
    status: params.status || undefined,
    page: params.page ?? 0,
    size: params.size ?? 50,
    q: params.q || undefined,
  });

export const adminAllPayoutsCursor = (params: AdminPayoutCursorParams = {}) =>
  api.get("/admin/finance/payouts", adminCursorPageSchema(adminPayoutSchema), {
    status: params.status || undefined,
    q: params.q || undefined,
    limit: params.limit ?? 50,
    cursor: params.cursor,
  });

export const adminApprovePayout = (id: string, reason: string) =>
  api.postWithQuery(`/admin/finance/payouts/${encodeURIComponent(id)}/approve`, adminPayoutSchema, {
    reason,
  });

export const adminRejectPayout = (id: string, reason: string) =>
  api.postWithQuery(`/admin/finance/payouts/${encodeURIComponent(id)}/reject`, adminPayoutSchema, {
    reason,
  });

export const adminSubmitPayout = (id: string, providerReference: string, attemptId: string) =>
  api.postWithQuery(`/admin/finance/payouts/${encodeURIComponent(id)}/submit`, adminPayoutSchema, {
    providerReference,
    attemptId,
  });

export const adminUnknownPayout = (id: string, reason: string) =>
  api.postWithQuery(`/admin/finance/payouts/${encodeURIComponent(id)}/unknown`, adminPayoutSchema, {
    reason,
  });

export const adminPaidPayout = (id: string, providerReference: string, evidence: string) =>
  api.postWithQuery(`/admin/finance/payouts/${encodeURIComponent(id)}/paid`, adminPayoutSchema, {
    providerReference,
    evidence,
  });

export const adminCompleteLegacyPayout = (id: string, body: PayoutActionBody) =>
  api.post(`/admin/finance/payouts/${encodeURIComponent(id)}/complete`, adminPayoutSchema, body);

export const adminFailLegacyPayout = (id: string, body: PayoutActionBody) =>
  api.post(`/admin/finance/payouts/${encodeURIComponent(id)}/fail`, adminPayoutSchema, body);

/**
 * Admin VietQR manual confirmation. The BE controller only accepts an
 * optional `bankReference` body — no amount, no note. See
 * payment-service/AdminVietQrController.
 */
export const adminConfirmVietQr = (paymentId: string, body: { bankReference?: string } = {}) =>
  api.post(
    `/admin/vietqr/confirm/${encodeURIComponent(paymentId)}`,
    z.unknown(),
    Object.keys(body).length > 0 ? body : undefined,
  );

// Dashboard
//
// Dashboard endpoints use the v2 typed metric contract and share the same
// period/granularity/limit query shape.
export type DashboardQueryParams = {
  from?: string;
  to?: string;
  granularity?: "day" | "week" | "month";
  limit?: number;
  asOf?: string;
};

export const dashboardSummary = (params: Pick<DashboardQueryParams, "from" | "to"> = {}) =>
  api.get("/admin/dashboard/summary", dashboardSummarySchema, params);
export const dashboardReport = (params: DashboardQueryParams = {}) =>
  api.get("/admin/dashboard/report", dashboardReportSchema, params);
export const dashboardExport = (params: DashboardQueryParams = {}) =>
  api.getBlob("/admin/dashboard/export", params);
export const dashboardRevenueResponseSchema = z
  .union([
    z.array(dashboardRevenuePointSchema),
    z.object({ points: z.array(dashboardRevenuePointSchema) }).passthrough(),
  ])
  .transform((response) => (Array.isArray(response) ? response : response.points));

export const dashboardRevenue = (
  params: Pick<DashboardQueryParams, "from" | "to" | "granularity"> = {},
) => api.get("/admin/dashboard/revenue", dashboardRevenueResponseSchema, params);
export const dashboardTopProducts = (params: DashboardQueryParams = {}) =>
  api.get("/admin/dashboard/top-products", z.array(dashboardTopProductSchema), params);
export const dashboardTopSellers = (params: DashboardQueryParams = {}) =>
  api.get("/admin/dashboard/top-sellers", z.array(dashboardTopSellerSchema), params);

// ─── Video admin ───────────────────────────────────────────────────────────────

/** Query params for the moderation queue — all fields are optional. */
export type AdminVideoModerationQueueParams = Record<
  string,
  string | number | boolean | null | undefined
>;

/** GET /admin/videos/moderation-queue — paginated PENDING_REVIEW videos. */
export const adminVideoModerationQueue = (params: AdminVideoModerationQueueParams = {}) =>
  api.get("/admin/videos/moderation-queue", adminVideoModerationQueuePageSchema, params);

export const adminVideoModerationQueueCursor = (params: AdminFilteredCursorParams = {}) =>
  api.get(
    "/admin/videos/moderation-queue",
    adminCursorPageSchema(adminVideoModerationQueueItemSchema),
    {
      q: params.q,
      limit: params.limit ?? 20,
      cursor: params.cursor,
    },
  );

/** GET /admin/videos/{videoId}/preview — presigned staging URL for admin preview. */
export const adminVideoPreview = (videoId: string) =>
  api.get(`/admin/videos/${encodeURIComponent(videoId)}/preview`, adminVideoPreviewSchema);

/** POST /admin/videos/{videoId}/approve — publish video. */
export const adminApproveVideo = (videoId: string) =>
  api.post(
    `/admin/videos/${encodeURIComponent(videoId)}/approve`,
    adminVideoModerationResponseSchema,
  );

/** POST /admin/videos/{videoId}/reject — reject with reason. */
export const adminRejectVideo = (videoId: string, body: { reason: string }) =>
  api.post(
    `/admin/videos/${encodeURIComponent(videoId)}/reject`,
    adminVideoModerationResponseSchema,
    body,
  );

/** GET /admin/videos/appeal-queue — paginated APPEAL_PENDING videos. */
export const adminVideoAppealsQueue = (params: { page?: number; size?: number } = {}) =>
  api.get("/admin/videos/appeal-queue", adminPageSchema(adminVideoAppealItemSchema), {
    page: params.page ?? 0,
    size: params.size ?? 20,
  });

export const adminVideoAppealsQueueCursor = (params: AdminCursorParams = {}) =>
  api.get("/admin/videos/appeal-queue", adminCursorPageSchema(adminVideoAppealItemSchema), {
    limit: params.limit ?? 20,
    cursor: params.cursor,
  });

/** POST /admin/videos/{videoId}/appeal/approve — re-publish after appeal. */
export const adminApproveAppeal = (videoId: string) =>
  api.post(
    `/admin/videos/${encodeURIComponent(videoId)}/appeal/approve`,
    adminVideoModerationResponseSchema,
  );

/** POST /admin/videos/{videoId}/appeal/reject — final rejection after appeal. */
export const adminRejectAppeal = (videoId: string, body: { reason: string }) =>
  api.post(
    `/admin/videos/${encodeURIComponent(videoId)}/appeal/reject`,
    adminVideoModerationResponseSchema,
    body,
  );
