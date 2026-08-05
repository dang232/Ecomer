import {
  ArrowUpRight,
  CheckCircle2,
  RotateCcw,
  ShoppingBag,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { Surface } from "@/shared/ui";

import type { UrgentTask, UrgentTaskKind } from "../model/dashboard-view";

interface UrgentTaskListProps {
  tasks: readonly UrgentTask[];
  isLoading: boolean;
  hasSourceError: boolean;
  onRetry: () => void;
}

const TASK_ICONS: Record<UrgentTaskKind, LucideIcon> = {
  order: ShoppingBag,
  return: RotateCcw,
  payout: Wallet,
};

export function UrgentTaskList({ tasks, isLoading, hasSourceError, onRetry }: UrgentTaskListProps) {
  const { t } = useTranslation();

  return (
    <Surface padding="none" className="min-w-0 overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
        <div>
          <div className="flex items-center gap-2">
            <TriangleAlert size={18} className="text-accent" aria-hidden="true" />
            <h2 className="text-base font-bold text-foreground">
              {t("seller.dashboard.urgentTitle")}
            </h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("seller.dashboard.urgentSubtitle")}
          </p>
        </div>
        {tasks.length > 0 ? (
          <span className="rounded-full bg-warning-light px-2.5 py-1 text-xs font-bold text-[var(--color-warning-text)]">
            {tasks.length}
          </span>
        ) : null}
      </div>

      {hasSourceError ? (
        <div
          className="border-b border-border px-4 py-4 text-sm text-[var(--color-warning-text)] sm:px-5"
          role="status"
        >
          <p>{t("seller.dashboard.urgentError")}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 min-h-[var(--target-web)] font-semibold underline underline-offset-2"
          >
            {t("seller.dashboard.urgentRetry")}
          </button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="px-4 py-10 text-center text-sm text-muted-foreground" role="status">
          {t("seller.dashboard.urgentLoading")}
        </div>
      ) : tasks.length === 0 && !hasSourceError ? (
        <div className="flex flex-col items-center px-5 py-12 text-center">
          <CheckCircle2 size={32} className="text-success" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-foreground">
            {t("seller.dashboard.urgentEmpty")}
          </p>
          <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">
            {t("seller.dashboard.urgentEmptyHint")}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border" data-testid="seller-urgent-tasks">
          {tasks.map((task) => {
            const Icon = TASK_ICONS[task.kind];
            return (
              <li key={task.id}>
                <Link
                  to={task.href}
                  className="flex min-h-[var(--target-web)] items-center gap-3 px-4 py-4 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:px-5"
                  aria-label={t("seller.dashboard.openTask", {
                    task: t(`seller.urgentTasks.${task.kind}`),
                  })}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-warning-light text-[var(--color-warning-text)]">
                    <Icon size={17} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {t(`seller.urgentTasks.${task.kind}`)}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {t("seller.dashboard.taskReference", { id: task.label })}
                    </span>
                  </span>
                  <ArrowUpRight
                    size={16}
                    className="shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Surface>
  );
}
