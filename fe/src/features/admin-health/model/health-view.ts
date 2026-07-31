import { z } from "zod";

import { apiUrl } from "@/shared/config";

export interface ServiceDef {
  id: string;
  labelKey: string;
  healthPath: string;
}

export const SERVICE_HEALTH_ENDPOINTS: readonly ServiceDef[] = [
  { id: "gateway", labelKey: "admin.health.gateway", healthPath: "/actuator/health" },
  {
    id: "user",
    labelKey: "admin.health.userService",
    healthPath: "/user-service/actuator/health",
  },
  {
    id: "order",
    labelKey: "admin.health.orderService",
    healthPath: "/order-service/actuator/health",
  },
  {
    id: "payment",
    labelKey: "admin.health.paymentService",
    healthPath: "/payment-service/actuator/health",
  },
  {
    id: "catalog",
    labelKey: "admin.health.catalogService",
    healthPath: "/product-service/actuator/health",
  },
  {
    id: "notification",
    labelKey: "admin.health.notificationService",
    healthPath: "/notification-service/health",
  },
];

export type HealthStatus = "up" | "down" | "checking";

export interface ServiceHealth {
  id: string;
  status: HealthStatus;
  latencyMs: number | null;
  detail?: string;
}

export interface HealthCheckResult {
  id: string;
  status: HealthStatus;
  latencyMs: number;
  statusCode: number | null;
}

const healthSchema = z.object({ status: z.string() }).passthrough();

const HEALTH_TIMEOUT_MS = 5000;

/**
 * Per-request latency comes from performance.now() so a slow `/health` endpoint
 * contributes to a slow aggregate, not a contrived `Date.now()` derived ms.
 * ponytail: if we ever want server-side latency too, plumb a Server-Timing
 * header through here.
 */
export async function checkHealth(
  service: ServiceDef,
  parentSignal: AbortSignal,
): Promise<HealthCheckResult> {
  const start = performance.now();
  try {
    const timeout = AbortSignal.timeout(HEALTH_TIMEOUT_MS);
    const response = await fetch(apiUrl(service.healthPath), {
      signal: AbortSignal.any([parentSignal, timeout]),
      credentials: "omit",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return {
        id: service.id,
        status: "down",
        latencyMs: Math.round(performance.now() - start),
        statusCode: response.status,
      };
    }
    const body = (await response.json()) as unknown;
    const parsed = healthSchema.safeParse(body);
    const statusValue = parsed.success ? parsed.data.status?.toUpperCase() : "";
    return {
      id: service.id,
      status: ["UP", "OK"].includes(statusValue ?? "") ? "up" : "down",
      latencyMs: Math.round(performance.now() - start),
      statusCode: response.status,
    };
  } catch {
    return {
      id: service.id,
      status: "down",
      latencyMs: Math.round(performance.now() - start),
      statusCode: null,
    };
  }
}

export function summarizeHealth(results: readonly ServiceHealth[]): {
  up: number;
  down: number;
  total: number;
  allUp: boolean;
} {
  const total = results.length;
  const up = results.filter((r) => r.status === "up").length;
  const down = results.filter((r) => r.status === "down").length;
  return { up, down, total, allUp: total > 0 && down === 0 && up === total };
}