import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { InlineAlert } from "@/shared/ui";

import type { AdminDashboardView } from "../model/dashboard-view";

interface OperationalExceptionsProps {
  items: AdminDashboardView["exceptions"];
}

export function OperationalExceptions({ items }: OperationalExceptionsProps) {
  const { t } = useTranslation();

  const pending = items.filter((item) => item.count > 0);

  return (
    <div className="bg-card rounded-2xl p-5 shadow-sm">
      <h3 className="font-bold text-foreground mb-4">
        {t("admin.dashboard.exceptionsTitle", "Needs attention")}
      </h3>
      {pending.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          {t("admin.dashboard.exceptionsEmpty", "All caught up.")}
        </p>
      ) : (
        <div className="space-y-3" data-testid="operational-exceptions">
          {pending.map((item) => (
            <InlineAlert
              key={item.kind}
              tone="warning"
              title={
                <span className="flex items-center justify-between">
                  <span>
                    {t(
                      `admin.nav.${item.kind === "seller" ? "sellers" : item.kind === "review" ? "reviews" : item.kind}`,
                    )}
                  </span>
                  <span className="font-black tabular-nums">{item.count}</span>
                </span>
              }
            >
              <Link
                to={item.href}
                className="text-xs font-semibold underline underline-offset-2 hover:no-underline"
              >
                {t("admin.dashboard.viewQueue", "View queue")}
              </Link>
            </InlineAlert>
          ))}
        </div>
      )}
    </div>
  );
}
