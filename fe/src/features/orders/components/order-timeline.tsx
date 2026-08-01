import { CheckCircle2, Clock3 } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { OrderTimelineEntry } from "../model/order-view";

interface OrderTimelineProps {
  entries: readonly OrderTimelineEntry[];
}

export function OrderTimeline({ entries }: OrderTimelineProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage === "vi" ? "vi-VN" : "en-US";

  return (
    <ol className="space-y-4">
      {entries.map((entry) => (
        <li key={entry.id} className="flex gap-3">
          <div
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              entry.current ? "bg-primary text-white" : "bg-primary/10 text-primary"
            }`}
          >
            {entry.current ? <Clock3 size={16} /> : <CheckCircle2 size={16} />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{t(entry.labelKey)}</p>
            <p className="text-xs text-muted-foreground">
              {entry.occurredAt
                ? new Date(entry.occurredAt).toLocaleString(locale, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : t("orders.timeline.pendingTimestamp")}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
