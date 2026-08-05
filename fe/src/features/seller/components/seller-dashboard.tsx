import { ArrowUpRight, CheckCircle2, CirclePause, Store } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import type { SellerProfile } from "@/shared/contracts/api";
import { SegmentedControl, Surface } from "@/shared/ui";

import type { SellerDashboardView } from "../model/dashboard-view";

import { RevenueChart } from "./revenue-chart";
import { SellerKpiStrip } from "./seller-kpi-strip";
import { UrgentTaskList } from "./urgent-task-list";

interface SellerDashboardProps {
  view: SellerDashboardView;
  profile: SellerProfile;
  days: number;
  onDaysChange: (days: number) => void;
  revenueLoading: boolean;
  revenueError: unknown;
  onRetryRevenue: () => void;
  operationalLoading: boolean;
  operationalError: boolean;
  onRetryOperational: () => void;
}

const DAY_OPTIONS = [7, 30, 90] as const;

export function SellerDashboard({
  view,
  profile,
  days,
  onDaysChange,
  revenueLoading,
  revenueError,
  onRetryRevenue,
  operationalLoading,
  operationalError,
  onRetryOperational,
}: SellerDashboardProps) {
  const { t } = useTranslation();

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 py-2" data-testid="seller-dashboard">
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="mb-1 text-sm font-semibold text-primary">{t("seller.dashboard.eyebrow")}</p>
          <h1 className="truncate text-2xl font-bold text-foreground sm:text-3xl">
            {view.shopName || t("seller.shopFallback")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            {t("seller.dashboard.subtitle")}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-light px-2.5 py-1 text-[var(--color-success-text)]">
              <CheckCircle2 size={14} aria-hidden="true" />
              {profile.approved
                ? t("seller.dashboard.statusApproved")
                : t("seller.dashboard.statusPending")}
            </span>
            <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
              {t("seller.dashboard.tier", { tier: profile.tier })}
            </span>
            {profile.vacationMode ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-light px-2.5 py-1 text-[var(--color-warning-text)]">
                <CirclePause size={14} aria-hidden="true" />
                {t("seller.dashboard.vacationOn")}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          <SegmentedControl
            ariaLabel={t("seller.dashboard.daysLabel")}
            value={String(days)}
            items={DAY_OPTIONS.map((option) => ({
              value: String(option),
              label: t("seller.dashboard.daysOption", { count: option }),
            }))}
            onValueChange={(value) => onDaysChange(Number(value))}
          />
          <Link
            to={`/sellers/${encodeURIComponent(profile.id)}`}
            className="inline-flex min-h-[var(--target-web)] items-center justify-center gap-2 rounded-[var(--radius-control)] border border-border bg-card px-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Store size={16} className="text-primary" aria-hidden="true" />
            {t("seller.dashboard.viewStorefront")}
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <SellerKpiStrip values={view.kpis} days={days} isLoading={revenueLoading} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(19rem,1fr)]">
        <RevenueChart
          points={view.revenue}
          days={days}
          isLoading={revenueLoading}
          error={revenueError}
          onRetry={onRetryRevenue}
        />
        <UrgentTaskList
          tasks={view.urgentTasks}
          isLoading={operationalLoading}
          hasSourceError={operationalError}
          onRetry={onRetryOperational}
        />
      </div>

      <Surface
        padding="md"
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-primary-light text-primary">
            <Store size={17} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {t("seller.dashboard.workflowTitle")}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {t("seller.dashboard.workflowHint")}
            </p>
          </div>
        </div>
        <Link
          to="/seller/settings"
          className="inline-flex min-h-[var(--target-web)] shrink-0 items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          {t("seller.dashboard.manageShop")}
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </Surface>
    </div>
  );
}

export { DAY_OPTIONS };
