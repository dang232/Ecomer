import { afterEach, describe, expect, it, vi } from "vitest";

import { SERVICE_HEALTH_ENDPOINTS, checkHealth, summarizeHealth } from "../model/health-view";

describe("SERVICE_HEALTH_ENDPOINTS", () => {
  it("has at least 6 services", () => {
    expect(SERVICE_HEALTH_ENDPOINTS.length).toBeGreaterThanOrEqual(6);
  });

  it("every service has a unique id", () => {
    const ids = SERVICE_HEALTH_ENDPOINTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every service has a labelKey and a healthPath", () => {
    for (const s of SERVICE_HEALTH_ENDPOINTS) {
      expect(s.labelKey.startsWith("admin.health.")).toBe(true);
      expect(s.healthPath.startsWith("/")).toBe(true);
    }
  });
});

describe("summarizeHealth", () => {
  it("allUp is true when every service is up", () => {
    expect(
      summarizeHealth([
        { id: "a", status: "up", latencyMs: 10 },
        { id: "b", status: "up", latencyMs: 12 },
      ]),
    ).toEqual({ up: 2, down: 0, total: 2, allUp: true });
  });

  it("allUp is false when at least one is down", () => {
    expect(
      summarizeHealth([
        { id: "a", status: "up", latencyMs: 10 },
        { id: "b", status: "down", latencyMs: 5000 },
      ]),
    ).toEqual({ up: 1, down: 1, total: 2, allUp: false });
  });

  it("allUp is false when at least one is still checking", () => {
    expect(
      summarizeHealth([
        { id: "a", status: "up", latencyMs: 10 },
        { id: "b", status: "checking", latencyMs: null },
      ]),
    ).toEqual({ up: 1, down: 0, total: 2, allUp: false });
  });

  it("allUp is false when there are zero services", () => {
    expect(summarizeHealth([])).toEqual({ up: 0, down: 0, total: 0, allUp: false });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("checkHealth", () => {
  it("marks a service down when the payload shape is invalid", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ state: "BROKEN" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await checkHealth(
      SERVICE_HEALTH_ENDPOINTS[0],
      new AbortController().signal,
    );

    expect(result.id).toBe(SERVICE_HEALTH_ENDPOINTS[0].id);
    expect(result.status).toBe("down");
    expect(result.statusCode).toBe(200);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("marks a service up when the payload status is UP", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "UP" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await checkHealth(
      SERVICE_HEALTH_ENDPOINTS[0],
      new AbortController().signal,
    );

    expect(result.status).toBe("up");
    expect(result.statusCode).toBe(200);
  });
});
