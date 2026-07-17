import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const API_BASE =
  (import.meta.env as Record<string, string | undefined>).VITE_API_URL ?? "http://localhost:8080";

interface ServiceDef {
  id: string;
  labelKey: string;
  healthUrl: string;
}

const SERVICES: ServiceDef[] = [
  { id: "gateway", labelKey: "admin.health.gateway", healthUrl: `${API_BASE}/actuator/health` },
  {
    id: "user",
    labelKey: "admin.health.userService",
    healthUrl: `${API_BASE}/user-service/actuator/health`,
  },
  {
    id: "order",
    labelKey: "admin.health.orderService",
    healthUrl: `${API_BASE}/order-service/actuator/health`,
  },
  {
    id: "payment",
    labelKey: "admin.health.paymentService",
    healthUrl: `${API_BASE}/payment-service/actuator/health`,
  },
  {
    id: "catalog",
    labelKey: "admin.health.catalogService",
    healthUrl: `${API_BASE}/product-service/actuator/health`,
  },
  {
    id: "notification",
    labelKey: "admin.health.notificationService",
    healthUrl: `${API_BASE}/notification-service/health`,
  },
];

type HealthStatus = "up" | "down" | "checking";

interface ServiceHealth {
  id: string;
  status: HealthStatus;
  detail?: string;
}

async function checkHealth(url: string): Promise<HealthStatus> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), credentials: "omit" });
    if (!res.ok) return "down";
    const body = (await res.json()) as { status?: string };
    // ponytail: Spring Actuator uses "UP", NestJS /health uses "ok"
    return ["UP", "OK"].includes(body.status?.toUpperCase() ?? "") ? "up" : "down";
  } catch {
    return "down";
  }
}

export function SystemHealth() {
  const { t } = useTranslation();
  const [results, setResults] = useState<ServiceHealth[]>(
    SERVICES.map((s) => ({ id: s.id, status: "checking" })),
  );
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  async function runChecks() {
    setResults(SERVICES.map((s) => ({ id: s.id, status: "checking" })));
    const checks = await Promise.all(
      SERVICES.map(async (s) => ({
        id: s.id,
        status: await checkHealth(s.healthUrl),
      })),
    );
    setResults(checks);
    setLastChecked(new Date());
  }

  useEffect(() => {
    void runChecks();
  }, []);

  const upCount = results.filter((r) => r.status === "up").length;
  const downCount = results.filter((r) => r.status === "down").length;
  const allUp = downCount === 0 && upCount === SERVICES.length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">{t("admin.health.title")}</h2>
        <button
          onClick={() => void runChecks()}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-border text-muted-foreground hover:bg-muted"
        >
          {t("admin.health.refresh")}
        </button>
      </div>

      <div
        className="rounded-2xl p-4 shadow-sm"
        style={{ background: allUp ? "#f0fdf4" : downCount > 0 ? "#fff7ed" : "#f8fafc" }}
      >
        <p className="text-sm font-semibold" style={{ color: allUp ? "#16a34a" : "#ea580c" }}>
          {allUp
            ? t("admin.health.allUp")
            : t("admin.health.someDown", { down: downCount, total: SERVICES.length })}
        </p>
        {lastChecked ? (
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("admin.health.lastChecked", {
              time: lastChecked.toLocaleTimeString("vi-VN"),
            })}
          </p>
        ) : null}
      </div>

      <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
        <div className="divide-y divide-gray-50">
          {SERVICES.map((svc) => {
            const result = results.find((r) => r.id === svc.id);
            const status = result?.status ?? "checking";
            return (
              <div key={svc.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{t(svc.labelKey)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{svc.healthUrl}</p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  {status === "checking" ? (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                      <span
                        className="w-2 h-2 rounded-full bg-gray-400 animate-pulse"
                        aria-hidden="true"
                      />
                      {t("admin.health.checking")}
                    </span>
                  ) : status === "up" ? (
                    <span
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{ background: "#dcfce7", color: "#16a34a" }}
                      role="status"
                      aria-label={t("admin.health.up")}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: "#16a34a" }}
                        aria-hidden="true"
                      />
                      {t("admin.health.up")}
                    </span>
                  ) : (
                    <span
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{ background: "#fee2e2", color: "#dc2626" }}
                      role="status"
                      aria-label={t("admin.health.down")}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: "#dc2626" }}
                        aria-hidden="true"
                      />
                      {t("admin.health.down")}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
