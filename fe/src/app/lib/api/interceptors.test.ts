import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// Mock native-auth BEFORE importing anything that pulls it in.
let liveToken: string | null = null;
const refreshTokensMock = vi.fn();
vi.mock("../auth/native-auth", () => ({
  getAccessToken: () => liveToken,
  setLiveTokenSet: vi.fn((next: { accessToken: string } | null) => {
    liveToken = next?.accessToken ?? null;
  }),
  refreshTokens: (...args: unknown[]) => refreshTokensMock(...args),
}));

import { api, request } from "./client";
import { ApiError } from "./envelope";
import {
  authInterceptor,
  contentTypeInterceptor,
  correlationIdInterceptor,
  envelopeInterceptor,
  errorStatusInterceptor,
  idempotencyInterceptor,
  jsonParseInterceptor,
  retryInterceptor,
  telemetryInterceptor,
  UnauthorizedError,
  type RequestContext,
  type ResponseContext,
} from "./interceptors";
import { clearTelemetry, getTelemetry } from "./telemetry-store";

const fetchSpy = vi.spyOn(global, "fetch");

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    ...init,
  });
}

function makeRequestCtx(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    url: "http://localhost:8080/x",
    init: { method: "GET", headers: {} },
    correlationId: "cid-test",
    meta: { auth: false, hasBody: false },
    ...overrides,
  };
}

beforeEach(() => {
  fetchSpy.mockReset();
  refreshTokensMock.mockReset();
  liveToken = null;
  clearTelemetry();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("request interceptors", () => {
  it("correlationIdInterceptor sets X-Correlation-Id from ctx", async () => {
    const ctx = makeRequestCtx({ correlationId: "abc-123" });
    const out = await correlationIdInterceptor(ctx);
    expect((out.init.headers as Record<string, string>)["X-Correlation-Id"]).toBe("abc-123");
  });

  it("contentTypeInterceptor sets Accept and Content-Type only when body is present", async () => {
    const noBody = await contentTypeInterceptor(makeRequestCtx());
    const noBodyHeaders = noBody.init.headers as Record<string, string>;
    expect(noBodyHeaders.Accept).toBe("application/json");
    expect(noBodyHeaders["Content-Type"]).toBeUndefined();

    const withBody = await contentTypeInterceptor(
      makeRequestCtx({ meta: { auth: false, hasBody: true } }),
    );
    expect((withBody.init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json",
    );
  });

  it("idempotencyInterceptor only writes the header when a key is supplied", async () => {
    const without = await idempotencyInterceptor(makeRequestCtx());
    expect((without.init.headers as Record<string, string>)["Idempotency-Key"]).toBeUndefined();

    const withKey = await idempotencyInterceptor(
      makeRequestCtx({ meta: { auth: false, hasBody: false, idempotencyKey: "key-1" } }),
    );
    expect((withKey.init.headers as Record<string, string>)["Idempotency-Key"]).toBe("key-1");
  });

  it("authInterceptor skips Authorization when meta.auth is false", async () => {
    liveToken = "jwt";
    const out = await authInterceptor(makeRequestCtx({ meta: { auth: false, hasBody: false } }));
    expect((out.init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("authInterceptor sets Authorization from the live access token", async () => {
    liveToken = "jwt-xyz";
    const out = await authInterceptor(makeRequestCtx({ meta: { auth: true, hasBody: false } }));
    expect((out.init.headers as Record<string, string>).Authorization).toBe("Bearer jwt-xyz");
  });

  it("authInterceptor leaves Authorization unset when no token is loaded", async () => {
    liveToken = null;
    const out = await authInterceptor(makeRequestCtx({ meta: { auth: true, hasBody: false } }));
    expect((out.init.headers as Record<string, string>).Authorization).toBeUndefined();
  });
});

describe("response interceptors", () => {
  it("jsonParseInterceptor populates parsed for valid JSON", async () => {
    const ctx: ResponseContext = {
      request: makeRequestCtx(),
      response: jsonResponse({ hello: "world" }),
      parsed: null,
    };
    const out = await jsonParseInterceptor(ctx);
    expect(out.parsed).toEqual({ hello: "world" });
  });

  it("jsonParseInterceptor throws INVALID_JSON for non-JSON bodies", async () => {
    const ctx: ResponseContext = {
      request: makeRequestCtx(),
      response: new Response("<html>oops</html>", { status: 200 }),
      parsed: null,
    };
    await expect(jsonParseInterceptor(ctx)).rejects.toMatchObject({
      name: "ApiError",
      errorCode: "INVALID_JSON",
    });
  });

  it("errorStatusInterceptor passes 2xx through unchanged", async () => {
    const ctx: ResponseContext = {
      request: makeRequestCtx(),
      response: new Response(null, { status: 204 }),
      parsed: null,
    };
    const out = await errorStatusInterceptor(ctx);
    expect(out).toBe(ctx);
  });

  it("errorStatusInterceptor throws ApiError with errorCode/message from the body on non-2xx", () => {
    const ctx: ResponseContext = {
      request: makeRequestCtx(),
      response: new Response("ignored", { status: 500 }),
      parsed: { errorCode: "BOOM", message: "engine failed" },
    };
    expect(() => errorStatusInterceptor(ctx)).toThrow(ApiError);
    try {
      errorStatusInterceptor(ctx);
    } catch (err) {
      expect((err as ApiError).status).toBe(500);
      expect((err as ApiError).errorCode).toBe("BOOM");
      expect((err as ApiError).message).toBe("engine failed");
    }
  });

  it("envelopeInterceptor unwraps the data field on success", async () => {
    const schema = z.object({ id: z.string() });
    const interceptor = envelopeInterceptor(schema);
    const ctx: ResponseContext = {
      request: makeRequestCtx(),
      response: new Response(null, { status: 200 }),
      parsed: {
        success: true,
        message: "ok",
        data: { id: "p1" },
        errorCode: null,
        timestamp: "2026-05-15T00:00:00Z",
      },
    };
    const out = await interceptor(ctx);
    expect(out.parsed).toEqual({ id: "p1" });
  });

  it("envelopeInterceptor throws ApiError when envelope.success is false", () => {
    const interceptor = envelopeInterceptor(z.object({ id: z.string() }));
    const ctx: ResponseContext = {
      request: makeRequestCtx(),
      response: new Response(null, { status: 200, headers: { "x-correlation-id": "cid-9" } }),
      parsed: {
        success: false,
        message: "denied",
        data: { id: "p1" },
        errorCode: "FORBIDDEN",
        timestamp: "2026-05-15T00:00:00Z",
      },
    };
    expect(() => interceptor(ctx)).toThrow(ApiError);
  });
});

describe("interceptor chain ordering (via request())", () => {
  it("applies request interceptors in order: correlation-id, content-type, idempotency, auth", async () => {
    liveToken = "jwt";
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        message: "ok",
        data: { id: "ord-1" },
        errorCode: null,
        timestamp: "2026-05-15T00:00:00Z",
      }),
    );

    await api.post(
      "/orders",
      z.object({ id: z.string() }),
      { items: [] },
      { idempotencyKey: "key-2" },
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const init = fetchSpy.mock.calls[0][1];
    const headers = init?.headers as Record<string, string>;
    expect(headers["X-Correlation-Id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(headers.Accept).toBe("application/json");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["Idempotency-Key"]).toBe("key-2");
    expect(headers.Authorization).toBe("Bearer jwt");
  });
});

describe("401 retry path", () => {
  it("on 401: refreshes token then retries the same URL with the new bearer", async () => {
    liveToken = "old-jwt";
    refreshTokensMock.mockImplementation(async () => ({
      accessToken: "new-jwt",
      accessExpiresAt: Date.now() + 60_000,
    }));

    fetchSpy.mockResolvedValueOnce(new Response("unauthorized", { status: 401 }));
    fetchSpy.mockImplementationOnce(async () =>
      jsonResponse({
        success: true,
        message: "ok",
        data: { id: "p1" },
        errorCode: null,
        timestamp: "2026-05-15T00:00:00Z",
      }),
    );

    const result = await request({
      method: "GET",
      path: "/me",
      schema: z.object({ id: z.string() }),
    });

    expect(result).toEqual({ id: "p1" });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const retryInit = fetchSpy.mock.calls[1][1];
    const retryHeaders = retryInit?.headers as Record<string, string>;
    expect(retryHeaders.Authorization).toBe("Bearer new-jwt");
  });

  it("on 401 then refresh fails: throws ApiError UNAUTHORIZED and dispatches auth:unauthorized", async () => {
    liveToken = "old-jwt";
    refreshTokensMock.mockRejectedValue(new Error("refresh denied"));

    fetchSpy.mockResolvedValueOnce(new Response("unauthorized", { status: 401 }));

    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    const err = await request({
      method: "GET",
      path: "/me",
      schema: z.object({ id: z.string() }),
    }).catch((e) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(401);
    expect((err as ApiError).errorCode).toBe("UNAUTHORIZED");
    expect(dispatchSpy).toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("on 401 retry that returns 401 again: throws UNAUTHORIZED", async () => {
    liveToken = "old-jwt";
    refreshTokensMock.mockResolvedValue({
      accessToken: "new-jwt",
      accessExpiresAt: Date.now() + 60_000,
    });

    fetchSpy.mockResolvedValueOnce(new Response("unauthorized", { status: 401 }));
    fetchSpy.mockResolvedValueOnce(new Response("still unauthorized", { status: 401 }));

    const err = await request({
      method: "GET",
      path: "/me",
      schema: z.object({ id: z.string() }),
    }).catch((e) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(401);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe("retryInterceptor", () => {
  function errCtx(overrides: Partial<RequestContext> = {}): RequestContext {
    return makeRequestCtx({
      url: "http://localhost:8080/x",
      init: { method: "GET", headers: {} },
      correlationId: "cid-retry",
      meta: {
        auth: true,
        hasBody: false,
        attempts: 1,
        startedAt: Date.now(),
        method: "GET",
        path: "/x",
      },
      ...overrides,
    });
  }

  function apiErr(status: number): ApiError {
    return new ApiError(status, "BOOM", `HTTP ${status}`, "cid-retry");
  }

  it("returns undefined for non-ApiError", async () => {
    expect(await retryInterceptor(new Error("net"), errCtx())).toBeUndefined();
  });

  it("returns undefined for 4xx (not retryable)", async () => {
    expect(await retryInterceptor(apiErr(404), errCtx())).toBeUndefined();
    expect(await retryInterceptor(apiErr(409), errCtx())).toBeUndefined();
  });

  it("retries a safe GET once using a bounded Retry-After delay", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const ctx = errCtx();
    const error = new ApiError(429, "RATE_LIMITED", "slow down", "cid-retry", 0);

    const result = await retryInterceptor(error, ctx);

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(ctx.meta.attempts).toBe(2);
  });

  it("does not retry a 429 mutation even when it has an idempotency key", async () => {
    const ctx = errCtx({
      init: { method: "POST", headers: {} },
      meta: {
        auth: true,
        hasBody: true,
        idempotencyKey: "flash-key",
        attempts: 1,
        startedAt: Date.now(),
        method: "POST",
        path: "/flash-sale/reserve",
      },
    });

    expect(
      await retryInterceptor(new ApiError(429, "RATE_LIMITED", "slow down", "cid-retry", 0), ctx),
    ).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns undefined for 401 (owned by unauthorizedInterceptor)", async () => {
    expect(await retryInterceptor(apiErr(401), errCtx())).toBeUndefined();
  });

  it("retries 5xx up to 5 attempts and rethrows on final", async () => {
    fetchSpy.mockResolvedValue(new Response("oops", { status: 503 }));
    const ctx = errCtx();
    let result: Response | undefined;
    // Walk the chain manually: each call increments attempts and refetches.
    // After MAX_ATTEMPTS (5), retryInterceptor returns undefined.
    for (let i = 0; i < 5; i++) {
      result = (await retryInterceptor(apiErr(503), ctx)) ?? undefined;
      if (!result) break;
    }
    expect(result).toBeUndefined();
    expect(ctx.meta.attempts).toBe(5);
    expect(fetchSpy).toHaveBeenCalledTimes(4); // attempts 2..5 each fire one fetch
  }, 15000);

  it("does NOT retry POST without an idempotency key", async () => {
    const ctx = errCtx({
      init: { method: "POST", headers: {} },
      meta: {
        auth: true,
        hasBody: true,
        attempts: 1,
        startedAt: Date.now(),
        method: "POST",
        path: "/x",
      },
    });
    expect(await retryInterceptor(apiErr(500), ctx)).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("DOES retry POST when an idempotency key is supplied", async () => {
    fetchSpy.mockResolvedValue(new Response("oops", { status: 500 }));
    const ctx = errCtx({
      init: { method: "POST", headers: {} },
      meta: {
        auth: true,
        hasBody: true,
        idempotencyKey: "k1",
        attempts: 1,
        startedAt: Date.now(),
        method: "POST",
        path: "/x",
      },
    });
    await retryInterceptor(apiErr(500), ctx);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(ctx.meta.attempts).toBe(2);
  });

  it("throws UnauthorizedError when a retry fetch returns 401 mid-sequence", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("expired", { status: 401 }));
    const ctx = errCtx();
    await expect(retryInterceptor(apiErr(503), ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("does not throw UnauthorizedError for a 401 retry on an auth:false request", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("expired", { status: 401 }));
    const ctx = errCtx({
      meta: {
        auth: false,
        hasBody: false,
        attempts: 1,
        startedAt: Date.now(),
        method: "GET",
        path: "/x",
      },
    });
    // Should return the Response, not throw UnauthorizedError.
    const result = await retryInterceptor(apiErr(503), ctx);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });

  it("strips the base URL when meta.path is missing on cap-hit telemetry", async () => {
    fetchSpy.mockResolvedValue(new Response("oops", { status: 504 }));
    // Override ctx to omit meta.path; rely on ctx.url fallback.
    const ctx = errCtx({
      url: "https://api.example.internal/v1/orders",
      meta: {
        auth: true,
        hasBody: false,
        attempts: 1,
        startedAt: Date.now(),
        method: "GET",
        // no `path` here
      },
    });
    for (let i = 0; i < 5; i++) {
      const r = await retryInterceptor(apiErr(504), ctx);
      if (!r) break;
    }
    const records = getTelemetry();
    expect(records[0].path).toBe("/v1/orders");
    expect(records[0].path).not.toContain("api.example.internal");
  }, 15000);

  it("records telemetry with the final status after MAX_ATTEMPTS", async () => {
    fetchSpy.mockResolvedValue(new Response("oops", { status: 502 }));
    const ctx = errCtx();
    for (let i = 0; i < 5; i++) {
      const r = await retryInterceptor(apiErr(502), ctx);
      if (!r) break;
    }
    const records = getTelemetry();
    expect(records).toHaveLength(1);
    expect(records[0].status).toBe(502);
    expect(records[0].attempts).toBe(5);
    expect(records[0].path).toBe("/x");
  }, 15000);
});

describe("telemetryInterceptor", () => {
  it("records a record with status, attempts, duration on 2xx", () => {
    const ctx: ResponseContext = {
      request: makeRequestCtx({
        meta: {
          auth: true,
          hasBody: false,
          attempts: 1,
          startedAt: Date.now() - 50,
          method: "GET",
          path: "/orders",
        },
      }),
      response: new Response(null, { status: 200 }),
      parsed: null,
    };
    telemetryInterceptor(ctx);
    const records = getTelemetry();
    expect(records).toHaveLength(1);
    expect(records[0].status).toBe(200);
    expect(records[0].attempts).toBe(1);
    expect(records[0].path).toBe("/orders");
    expect(records[0].method).toBe("GET");
    expect(records[0].errorCode).toBeNull();
    expect(records[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it("extracts errorCode from parsed body on non-2xx", () => {
    const ctx: ResponseContext = {
      request: makeRequestCtx({
        meta: {
          auth: true,
          hasBody: false,
          attempts: 3,
          startedAt: Date.now(),
          method: "GET",
          path: "/orders",
        },
      }),
      response: new Response(null, { status: 503 }),
      parsed: { errorCode: "SVC_DOWN", message: "down" },
    };
    telemetryInterceptor(ctx);
    const records = getTelemetry();
    expect(records[0].status).toBe(503);
    expect(records[0].attempts).toBe(3);
    expect(records[0].errorCode).toBe("SVC_DOWN");
  });
});
