import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { PageContainer } from "@/shared/ui/page-container";
import { PageHeader } from "@/shared/ui/page-header";

import {
  SERVICE_HEALTH_ENDPOINTS,
  checkHealth,
  summarizeHealth,
  type HealthStatus,
  type ServiceHealth,
} from "../model/health-view";

// HealthStatus is referenced via the StatusPill `status` prop.

export function SystemHealth() {
  const { t } = useTranslation();
  const [results, setResults] = useState<ServiceHealth[]>(
    SERVICE_HEALTH_ENDPOINTS.map((s) => ({ id: s.id, status: "checking", latencyMs: null })),
  );
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    void runChecks();
    return () => controllerRef.current?.abort();
  }, []);

  async function runChecks() {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setResults(
      SERVICE_HEALTH_ENDPOINTS.map((s) => ({ id: s.id, status: "checking", latencyMs: null })),
    );
    setIsChecking(true);

    const checked = await Promise.all(
      SERVICE_HEALTH_ENDPOINTS.map(async (s) => {
        const result = await checkHealth(s, controller.signal);
        return {
          id: result.id,
          status: result.status,
          latencyMs: result.latencyMs,
        };
      }),
    );

    if (controller.signal.aborted) return;
    setResults(checked);
    setLastChecked(new Date());
    setIsChecking(false);
  }

  const summary = summarizeHealth(results);

  return (
    <PageContainer density="compact">
      <PageHeader
        title={t("admin.health.title")}
        description={t("admin.health.subtitle", { defaultValue: "" })}
        actions={
          <button
            onClick={() => void runChecks()}
            disabled={isChecking}
            className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            {t("admin.health.refresh") ?? "Refresh"}
          </button>
        }
      />

      <div
        className="rounded-2xl p-4 shadow-sm"
        style={{ background: summary.allUp ? "#f0fdf4" : summary.down > 0 ? "#fff7ed" : "#f8fafc" }}
      >
        <p
          className="text-sm font-semibold"
          style={{ color: summary.allUp ? "#16a34a" : "#ea580c" }}
        >
          {summary.allUp
            ? t("admin.health.allUp") ?? "All systems operational"
            : t("admin.health.someDown", { down: summary.down, total: summary.total })}
        </p>
        {lastChecked ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("admin.health.lastChecked", {
              time: lastChecked.toLocaleTimeString("vi-VN"),
            })}
          </p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl bg-card shadow-sm">
        <div className="divide-y divide-gray-50">
          {SERVICE_HEALTH_ENDPOINTS.map((svc) => {
            const result = results.find((r) => r.id === svc.id);
            const status = result?.status ?? "checking";
            return (
              <div key={svc.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{t(svc.labelKey)}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{svc.healthPath}</p>
                  {result?.latencyMs != null ? (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {t("admin.health.latencyMs", { ms: result.latencyMs, defaultValue: `${result.latencyMs} ms` })}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusPill status={status} t={t} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </PageContainer>
  );
}

function StatusPill({ status, t }: { status: HealthStatus; t: (k: string) => string }) {
  if (status === "up") {
    return (
      <span
        className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
        style={{ background: "#dcfce7", color: "#16a34a" }}
        role="status"
        aria-label={t("admin.health.up")}
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: "#16a34a" }}
          aria-hidden="true"
        />
        {t("admin.health.up")}
      </span>
    );
  }
  if (status === "down") {
    return (
      <span
        className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
        style={{ background: "#fee2e2", color: "#dc2626" }}
        role="status"
        aria-label={t("admin.health.down")}
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: "#dc2626" }}
          aria-hidden="true"
        />
        {t("admin.health.down")}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">
      <span className="h-2 w-2 animate-pulse rounded-full bg-gray-400" aria-hidden="true" />
      {t("admin.health.checking")}
    </span>
  );
}