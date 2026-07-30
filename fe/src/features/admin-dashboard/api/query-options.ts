import { queryOptions } from "@tanstack/react-query";

import {
  adminListSellers,
  adminOpenDisputes,
  adminPendingPayouts,
  adminPendingReviews,
  adminVideoModerationQueue,
  dashboardReport,
  dashboardRevenue,
  dashboardTopProducts,
  dashboardTopSellers,
} from "@/shared/api/endpoints/admin";
import type { DashboardQueryParams } from "@/shared/api/endpoints/admin";

export type AdminDashboardQueryParams = Pick<
  DashboardQueryParams,
  "from" | "to" | "granularity"
>;

const DEFAULT_PARAMS: AdminDashboardQueryParams = {
  from: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  to: new Date().toISOString().slice(0, 10),
  granularity: "day",
};

const ADMIN_DASHBOARD_KEYS_ALL = ["admin-dashboard"] as const;

export const adminDashboardKeys = {
  all: ADMIN_DASHBOARD_KEYS_ALL,
  report: (params: AdminDashboardQueryParams) =>
    [...ADMIN_DASHBOARD_KEYS_ALL, "report", params] as const,
  revenue: (params: AdminDashboardQueryParams) =>
    [...ADMIN_DASHBOARD_KEYS_ALL, "revenue", params] as const,
  topProducts: (params: AdminDashboardQueryParams) =>
    [...ADMIN_DASHBOARD_KEYS_ALL, "topProducts", params] as const,
  topSellers: (params: AdminDashboardQueryParams) =>
    [...ADMIN_DASHBOARD_KEYS_ALL, "topSellers", params] as const,
  counts: {
    all: [...ADMIN_DASHBOARD_KEYS_ALL, "counts"] as const,
    sellers: () => [...ADMIN_DASHBOARD_KEYS_ALL, "counts", "sellers"] as const,
    reviews: () => [...ADMIN_DASHBOARD_KEYS_ALL, "counts", "reviews"] as const,
    video: () => [...ADMIN_DASHBOARD_KEYS_ALL, "counts", "video"] as const,
    disputes: () => [...ADMIN_DASHBOARD_KEYS_ALL, "counts", "disputes"] as const,
    payouts: () => [...ADMIN_DASHBOARD_KEYS_ALL, "counts", "payouts"] as const,
  },
};

export const adminDashboardReportOptions = (params: AdminDashboardQueryParams = DEFAULT_PARAMS) =>
  queryOptions({
    queryKey: adminDashboardKeys.report(params),
    queryFn: () => dashboardReport({ ...params, limit: 5 }),
    staleTime: 60_000,
    retry: false,
  });

export const adminDashboardRevenueOptions = (params: AdminDashboardQueryParams = DEFAULT_PARAMS) =>
  queryOptions({
    queryKey: adminDashboardKeys.revenue(params),
    queryFn: () => dashboardRevenue(params),
    staleTime: 60_000,
    retry: false,
  });

export const adminDashboardTopProductsOptions = (
  params: AdminDashboardQueryParams = DEFAULT_PARAMS,
) =>
  queryOptions({
    queryKey: adminDashboardKeys.topProducts(params),
    queryFn: () => dashboardTopProducts(params),
    staleTime: 60_000,
    retry: false,
  });

export const adminDashboardTopSellersOptions = (
  params: AdminDashboardQueryParams = DEFAULT_PARAMS,
) =>
  queryOptions({
    queryKey: adminDashboardKeys.topSellers(params),
    queryFn: () => dashboardTopSellers(params),
    staleTime: 60_000,
    retry: false,
  });

export const adminDashboardSellersCountOptions = () =>
  queryOptions({
    queryKey: adminDashboardKeys.counts.sellers(),
    queryFn: () => adminListSellers({ q: "" }),
    select: (data) => data.content.length,
    staleTime: 30_000,
    retry: false,
  });

export const adminDashboardReviewsCountOptions = () =>
  queryOptions({
    queryKey: adminDashboardKeys.counts.reviews(),
    queryFn: () => adminPendingReviews({ q: "" }),
    select: (data) => data.length,
    staleTime: 30_000,
    retry: false,
  });

export const adminDashboardVideoCountOptions = () =>
  queryOptions({
    queryKey: adminDashboardKeys.counts.video(),
    queryFn: () =>
      adminVideoModerationQueue({ page: 0, size: 1 }),
    select: (data) => data.totalElements,
    staleTime: 30_000,
    retry: false,
  });

export const adminDashboardDisputesCountOptions = () =>
  queryOptions({
    queryKey: adminDashboardKeys.counts.disputes(),
    queryFn: () => adminOpenDisputes({ q: "" }),
    select: (data) => data.length,
    staleTime: 30_000,
    retry: false,
  });

export const adminDashboardPayoutsCountOptions = () =>
  queryOptions({
    queryKey: adminDashboardKeys.counts.payouts(),
    queryFn: () => adminPendingPayouts({ q: "" }),
    select: (data) => data.length,
    staleTime: 30_000,
    retry: false,
  });

export { DEFAULT_PARAMS };
