import { IconAlertCircle, IconDownload } from "@tabler/icons-react";
import { useQueries } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { dashboardExport } from "@/shared/api/endpoints/admin";
import { PageContainer, PageHeader, Tooltip } from "@/shared/ui";

import {
  adminDashboardReportOptions,
  adminDashboardRevenueOptions,
  adminDashboardTopProductsOptions,
  adminDashboardTopSellersOptions,
  adminDashboardSellersCountOptions,
  adminDashboardReviewsCountOptions,
  adminDashboardVideoCountOptions,
  adminDashboardDisputesCountOptions,
  adminDashboardPayoutsCountOptions,
  DEFAULT_PARAMS,
  type AdminDashboardQueryParams,
} from "../api/query-options";
import { toAdminDashboardView, type AdminDashboardView } from "../model/dashboard-view";

import { MarketplaceKpis } from "./marketplace-kpis";
import { OperationalExceptions } from "./operational-exceptions";
import { RevenueChart } from "./revenue-chart";
import { TopSellerTable } from "./top-seller-table";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateParam(raw: string | null, fallback: string): string {
  return raw && DATE_RE.test(raw) ? raw : fallback;
}

function DashboardDateControls() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const from = searchParams.get("from") ?? DEFAULT_PARAMS.from!;
  const to = searchParams.get("to") ?? DEFAULT_PARAMS.to!;
  const granularity = (searchParams.get("granularity") as "day" | "week" | "month") ?? "day";

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === "" || value === DEFAULT_PARAMS[key as keyof typeof DEFAULT_PARAMS]) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-muted-foreground">
        {t("admin.dashboard.from", "From")}
        <input
          type="date"
          value={from}
          max={to}
          onChange={(e) => setParam("from", e.target.value)}
          className="ml-1 border rounded px-2 py-1 text-sm"
        />
      </label>
      <label className="text-sm text-muted-foreground">
        {t("admin.dashboard.to", "To")}
        <input
          type="date"
          value={to}
          min={from}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setParam("to", e.target.value)}
          className="ml-1 border rounded px-2 py-1 text-sm"
        />
      </label>
      <select
        value={granularity}
        onChange={(e) => setParam("granularity", e.target.value)}
        className="border rounded px-2 py-1 text-sm"
      >
        <option value="day">{t("admin.dashboard.day", "Day")}</option>
        <option value="week">{t("admin.dashboard.week", "Week")}</option>
        <option value="month">{t("admin.dashboard.month", "Month")}</option>
      </select>
    </div>
  );
}

function ExportButton({ asOf }: { asOf?: string }) {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState(false);

  const params: AdminDashboardQueryParams = {
    from: parseDateParam(searchParams.get("from"), DEFAULT_PARAMS.from!),
    to: parseDateParam(searchParams.get("to"), DEFAULT_PARAMS.to!),
    granularity: (searchParams.get("granularity") as "day" | "week" | "month") ?? "day",
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(false);
    try {
      const blob = await dashboardExport({ ...params, asOf });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `vnshop-dashboard-${params.from}-to-${params.to}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError(true);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {exportError ? <span className="text-xs text-amber-600">{t("admin.dashboard.exportFailed")}</span> : null}
      <Tooltip content={t("admin.dashboard.exportReport")}>
        <button
          onClick={() => void handleExport()}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          <IconDownload size={15} />
          {isExporting ? t("admin.dashboard.exporting") : t("admin.dashboard.exportReport")}
        </button>
      </Tooltip>
    </div>
  );
}

export function AdminDashboard() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  const params: AdminDashboardQueryParams = {
    from: parseDateParam(searchParams.get("from"), DEFAULT_PARAMS.from!),
    to: parseDateParam(searchParams.get("to"), DEFAULT_PARAMS.to!),
    granularity: (searchParams.get("granularity") as "day" | "week" | "month") ?? "day",
  };

  const [reportResult, revenueResult, topProductsResult, topSellersResult, sellersCountResult, reviewsCountResult, videoCountResult, disputesCountResult, payoutsCountResult] =
    useQueries({
      queries: [
        adminDashboardReportOptions(params),
        adminDashboardRevenueOptions(params),
        adminDashboardTopProductsOptions(params),
        adminDashboardTopSellersOptions(params),
        adminDashboardSellersCountOptions(),
        adminDashboardReviewsCountOptions(),
        adminDashboardVideoCountOptions(),
        adminDashboardDisputesCountOptions(),
        adminDashboardPayoutsCountOptions(),
      ],
    });

  const summary = reportResult.data?.summary ?? null;
  const asOf = reportResult.data?.asOf;

  const view: AdminDashboardView = toAdminDashboardView({
    summary,
    report: reportResult.data ?? null,
    revenue: revenueResult.data ?? [],
    topProducts: topProductsResult.data ?? [],
    topSellers: topSellersResult.data ?? [],
    counts: {
      sellers: sellersCountResult.data ?? 0,
      reviews: reviewsCountResult.data ?? 0,
      video: videoCountResult.data ?? 0,
      disputes: disputesCountResult.data ?? 0,
      payouts: payoutsCountResult.data ?? 0,
    },
  });

  const anyError = reportResult.isError;

  return (
    <PageContainer density="compact">
      <PageHeader
        title={t("admin.dashboard.title")}
        description={t("admin.dashboard.subtitle")}
        actions={<DashboardDateControls />}
        className="mb-0"
      />
      {anyError ? <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 text-sm text-amber-800 dark:text-amber-200 flex items-center gap-3">
          <IconAlertCircle size={18} className="shrink-0 text-amber-500" />
          <p className="flex-1">{t("admin.dashboard.kpiLoadFailFriendly")}</p>
          <button
            type="button"
            onClick={() => reportResult.refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/50 border border-amber-300 dark:border-amber-700 px-3 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900 transition-colors"
          >
            {t("common.retry", "Retry")}
          </button>
        </div> : null}
      <MarketplaceKpis values={view.kpis} />
      <RevenueChart points={view.revenue} />
      <div className="grid gap-6 xl:grid-cols-2">
        <TopSellerTable rows={view.topSellers} />
        <OperationalExceptions items={view.exceptions} />
      </div>
      <div className="flex justify-end">
        <ExportButton asOf={asOf} />
      </div>
    </PageContainer>
  );
}
