import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { SellerDashboard, toSellerDashboardView } from "@/features/seller";
import { ApiError } from "@/shared/api";
import { sellerPendingOrders } from "@/shared/api/endpoints/orders";
import { listSellerReturns } from "@/shared/api/endpoints/returns";
import { sellerRevenue } from "@/shared/api/endpoints/seller-analytics";
import { myPayouts, myWallet } from "@/shared/api/endpoints/seller-finance";
import { getSeller } from "@/shared/api/endpoints/sellers";
import { sellerProfile } from "@/shared/api/endpoints/users";
import { Skeleton } from "@/shared/ui";

const DAY_VALUES = [7, 30, 90] as const;
const DEFAULT_DAYS = 30;

function parseDays(raw: string | null): number {
  const candidate = Number(raw);
  return DAY_VALUES.includes(candidate as (typeof DAY_VALUES)[number]) ? candidate : DEFAULT_DAYS;
}

function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 py-2" role="status" aria-busy="true">
      <div className="space-y-3 border-b border-border pb-5">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {DAY_VALUES.slice(0, 5).map((value) => (
          <Skeleton key={value} className="h-32" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(19rem,1fr)]">
        <Skeleton className="h-[380px]" />
        <Skeleton className="h-[380px]" />
      </div>
    </div>
  );
}

export function SellerDashboardRoute() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const days = parseDays(searchParams.get("days"));

  const profileQuery = useQuery({
    queryKey: ["seller", "profile"],
    queryFn: sellerProfile,
    retry: false,
  });
  const profile = profileQuery.data;
  const sellerId = profile?.id;

  const publicStatsQuery = useQuery({
    queryKey: ["seller", "public-stats", sellerId],
    queryFn: () => {
      if (!sellerId) throw new Error("A seller ID is required for public statistics");
      return getSeller(sellerId);
    },
    enabled: Boolean(sellerId),
    retry: false,
  });

  const revenueQuery = useQuery({
    queryKey: ["seller", "revenue", { days }],
    queryFn: () => sellerRevenue({ days }),
    enabled: Boolean(sellerId),
    staleTime: 60_000,
    retry: false,
  });

  const pendingQuery = useQuery({
    queryKey: ["seller", "pending-orders"],
    queryFn: () => sellerPendingOrders(),
    enabled: Boolean(sellerId),
    refetchInterval: 60_000,
    retry: false,
  });

  const returnsQuery = useQuery({
    queryKey: ["seller", "returns"],
    queryFn: listSellerReturns,
    enabled: Boolean(sellerId),
    refetchInterval: 60_000,
    retry: false,
  });

  const walletQuery = useQuery({
    queryKey: ["seller", "wallet"],
    queryFn: myWallet,
    enabled: Boolean(sellerId),
    retry: false,
  });

  const payoutsQuery = useQuery({
    queryKey: ["seller", "payouts"],
    queryFn: myPayouts,
    enabled: Boolean(sellerId),
    retry: false,
  });

  const dashboardView = useMemo(() => {
    if (!profile) return null;
    return toSellerDashboardView({
      profile,
      publicStats: publicStatsQuery.data ?? null,
      pendingOrders: pendingQuery.data ?? [],
      pendingReturns: returnsQuery.data ?? [],
      wallet: walletQuery.data,
      payouts: payoutsQuery.data ?? [],
      revenue: revenueQuery.data ?? [],
    });
  }, [
    pendingQuery.data,
    payoutsQuery.data,
    profile,
    publicStatsQuery.data,
    returnsQuery.data,
    revenueQuery.data,
    walletQuery.data,
  ]);

  const retryRevenue = useCallback(() => {
    void revenueQuery.refetch();
  }, [revenueQuery]);

  const retryOperational = useCallback(() => {
    void Promise.all([pendingQuery.refetch(), returnsQuery.refetch(), payoutsQuery.refetch()]);
  }, [pendingQuery, payoutsQuery, returnsQuery]);

  const retryProfile = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["seller", "profile"] });
  }, [queryClient]);

  const handleDaysChange = (nextDays: number) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (nextDays === DEFAULT_DAYS) next.delete("days");
        else next.set("days", String(nextDays));
        return next;
      },
      { replace: true },
    );
  };

  if (profileQuery.isLoading) return <DashboardLoading />;

  if (!profile || profileQuery.error) {
    const message = profileQuery.error instanceof ApiError ? profileQuery.error.message : "";
    return (
      <div className="mx-auto w-full max-w-[720px] py-8" role="alert">
        <div className="flex items-start gap-3 border-l-4 border-error bg-error-light px-4 py-4 text-sm text-error">
          <RefreshCw size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">{t("seller.dashboard.profileError")}</p>
            {message ? <p className="mt-1 text-xs">{message}</p> : null}
            <button
              type="button"
              onClick={retryProfile}
              className="mt-3 inline-flex min-h-[var(--target-web)] items-center gap-1.5 font-semibold underline underline-offset-2"
            >
              <RefreshCw size={14} aria-hidden="true" />
              {t("seller.dashboard.revenueRetry")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!dashboardView) return null;

  const operationalLoading =
    pendingQuery.isLoading || returnsQuery.isLoading || payoutsQuery.isLoading;
  const operationalError = pendingQuery.isError || returnsQuery.isError || payoutsQuery.isError;

  return (
    <SellerDashboard
      view={dashboardView}
      profile={profile}
      days={days}
      onDaysChange={handleDaysChange}
      revenueLoading={revenueQuery.isLoading}
      revenueError={revenueQuery.error}
      onRetryRevenue={retryRevenue}
      operationalLoading={operationalLoading}
      operationalError={operationalError}
      onRetryOperational={retryOperational}
    />
  );
}
