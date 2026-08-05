import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearTelemetry, getTelemetry, recordTelemetry } from "@/shared/api/telemetry-store";

const IS_DEV = Boolean((import.meta.env as Record<string, unknown>).DEV);

function rec(overrides: Partial<Parameters<typeof recordTelemetry>[0]> = {}) {
  return {
    correlationId: "cid-1",
    method: "GET",
    path: "/x",
    status: 200,
    durationMs: 10,
    attempts: 1,
    errorCode: null,
    timestamp: Date.now(),
    ...overrides,
  };
}

beforeEach(() => {
  clearTelemetry();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("telemetry-store", () => {
  it("returns records in insertion order", () => {
    recordTelemetry(rec({ correlationId: "a" }));
    recordTelemetry(rec({ correlationId: "b" }));
    const records = getTelemetry();
    expect(records.map((r) => r.correlationId)).toEqual(["a", "b"]);
  });

  it("clearTelemetry empties the buffer", () => {
    recordTelemetry(rec());
    expect(getTelemetry()).toHaveLength(1);
    clearTelemetry();
    expect(getTelemetry()).toHaveLength(0);
  });

  it("strips query string from path so PII is not retained", () => {
    recordTelemetry(rec({ path: "/users?email=secret@example.com" }));
    expect(getTelemetry()[0].path).toBe("/users");
  });

  it("emits a browser telemetry event in DEV mode", () => {
    if (!IS_DEV) return; // skip outside dev (e.g., CI)

    const listener = vi.fn();
    window.addEventListener("vnshop:telemetry", listener);
    recordTelemetry(rec({ method: "GET", path: "/x", status: 200, durationMs: 5 }));
    window.removeEventListener("vnshop:telemetry", listener);

    expect(listener).toHaveBeenCalledOnce();
    const event = listener.mock.calls[0][0] as CustomEvent<string>;
    const msg = event.detail;
    expect(msg).toContain("[vnshop]");
    expect(msg).toContain("GET");
    expect(msg).toContain("/x");
    expect(msg).toContain("200");
  });
});
