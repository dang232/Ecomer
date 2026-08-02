import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { TokenSet } from "../auth/native-auth";

// Mock native-auth BEFORE importing the client.
let liveToken: string | null = null;
const refreshTokensMock = vi.fn<() => Promise<TokenSet>>();
vi.mock("../auth/native-auth", () => ({
  getAccessToken: () => liveToken,
  setLiveTokenSet: vi.fn((next: { accessToken: string } | null) => {
    liveToken = next?.accessToken ?? null;
  }),
  refreshTokens: () => refreshTokensMock(),
}));

import { api, clearPublicResponseCache, request } from "./client";
import { ApiError } from "./envelope";

interface MockResponseInit {
  status?: number;
  body: unknown;
  headers?: Record<string, string>;
  bodyText?: string;
}

function mockResponse(init: MockResponseInit): Response {
  const status = init.status ?? 200;
  const text = init.bodyText ?? JSON.stringify(init.body);
  return new Response(text, {
    status,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

function fetchInputToUrl(input: Parameters<typeof globalThis.fetch>[0]): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

async function captureError<T>(promise: Promise<T>): Promise<unknown> {
  try {
    await promise;
  } catch (error: unknown) {
    return error;
  }
  throw new Error("Expected promise to reject");
}

const fetchSpy = vi.spyOn(global, "fetch");

beforeEach(() => {
  fetchSpy.mockReset();
  liveToken = null;
  refreshTokensMock.mockReset();
  clearPublicResponseCache();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("request", () => {
  const productSchema = z.object({ id: z.string(), name: z.string() });

  it("decodes a successful envelope and returns inner data", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockResponse({
        body: {
          success: true,
          message: "ok",
          data: { id: "p1", name: "Tai nghe" },
          errorCode: null,
          timestamp: "2026-05-15T00:00:00Z",
        },
      }),
    );

    const result = await request({
      method: "GET",
      path: "/products/p1",
      schema: productSchema,
      auth: false,
    });

    expect(result).toEqual({ id: "p1", name: "Tai nghe" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(fetchInputToUrl(url)).toContain("/products/p1");
    expect(init?.method).toBe("GET");
    const headers = init?.headers as Record<string, string>;
    expect(headers["X-Correlation-Id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(headers.Authorization).toBeUndefined();
  });

  it("throws ApiError when envelope.success is false, capturing errorCode and correlation id", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockResponse({
        body: {
          success: false,
          message: "Not found",
          data: null,
          errorCode: "PRODUCT_NOT_FOUND",
          timestamp: "2026-05-15T00:00:00Z",
        },
        headers: { "x-correlation-id": "cid-123" },
      }),
    );

    await expect(
      request({
        method: "GET",
        path: "/products/x",
        schema: z.null(),
        auth: false,
      }),
    ).rejects.toMatchObject({
      name: "ApiError",
      status: 200,
      errorCode: "PRODUCT_NOT_FOUND",
      message: "Not found",
      correlationId: "cid-123",
    });
  });

  it("throws ApiError on HTTP 5xx with the server message", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockResponse({
        status: 503,
        body: { message: "downstream is down", errorCode: "SERVICE_UNAVAILABLE" },
      }),
    );

    const err = await captureError(
      request({
        method: "GET",
        path: "/orders",
        schema: z.array(z.unknown()),
        auth: false,
      }),
    );

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(503);
    expect((err as ApiError).errorCode).toBe("SERVICE_UNAVAILABLE");
    expect((err as ApiError).message).toBe("downstream is down");
  });

  it("throws MALFORMED_RESPONSE when the envelope shape doesn't match", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockResponse({
        body: { not: "an envelope" },
      }),
    );

    const err = await captureError(
      request({
        method: "GET",
        path: "/anything",
        schema: z.object({}),
        auth: false,
      }),
    );

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).errorCode).toBe("MALFORMED_RESPONSE");
  });

  it("throws INVALID_JSON when the body isn't JSON", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("<html>oops</html>", { status: 200, headers: { "content-type": "text/html" } }),
    );

    const err = await captureError(
      request({
        method: "GET",
        path: "/anything",
        schema: z.object({}),
        auth: false,
      }),
    );

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).errorCode).toBe("INVALID_JSON");
  });

  it("attaches Authorization, Idempotency-Key, and JSON body for POST", async () => {
    liveToken = "jwt-abc";
    fetchSpy.mockResolvedValueOnce(
      mockResponse({
        body: {
          success: true,
          message: "ok",
          data: { id: "ord1" },
          errorCode: null,
          timestamp: "2026-05-15T00:00:00Z",
        },
      }),
    );

    const result = await api.post(
      "/orders",
      z.object({ id: z.string() }),
      { items: [{ productId: "p1", quantity: 2 }] },
      { idempotencyKey: "abc-key" },
    );

    expect(result).toEqual({ id: "ord1" });
    const [, init] = fetchSpy.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer jwt-abc");
    expect(headers["Idempotency-Key"]).toBe("abc-key");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(init?.body).toBe(JSON.stringify({ items: [{ productId: "p1", quantity: 2 }] }));
  });

  it("appends defined query params and skips undefined/null", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockResponse({
        body: {
          success: true,
          message: "ok",
          data: [],
          errorCode: null,
          timestamp: "2026-05-15T00:00:00Z",
        },
      }),
    );

    await api.get("/products", z.array(z.unknown()), {
      q: "tai nghe",
      page: 2,
      brand: undefined,
      category: null,
    });

    const [url] = fetchSpy.mock.calls[0];
    const u = new URL(fetchInputToUrl(url));
    expect(u.searchParams.get("q")).toBe("tai nghe");
    expect(u.searchParams.get("page")).toBe("2");
    expect(u.searchParams.has("brand")).toBe(false);
    expect(u.searchParams.has("category")).toBe(false);
  });

  it("serializes repeated query values without collapsing them", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockResponse({
        body: {
          success: true,
          message: "ok",
          data: [],
          errorCode: null,
          timestamp: "2026-05-15T00:00:00Z",
        },
      }),
    );

    await api.get("/search/v2", z.array(z.unknown()), { tag: ["wireless", "bluetooth"] });

    const [url] = fetchSpy.mock.calls[0];
    expect(new URL(fetchInputToUrl(url)).searchParams.getAll("tag")).toEqual([
      "wireless",
      "bluetooth",
    ]);
  });

  it("returns a binary response without applying the JSON envelope contract", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("section,value\nsummary,900000\n", {
        status: 200,
        headers: { "content-type": "text/csv" },
      }),
    );

    const blob = await api.getBlob("/admin/dashboard/export", { from: "2026-07-01" });

    expect(await blob.text()).toBe("section,value\nsummary,900000\n");
    const [url] = fetchSpy.mock.calls[0];
    expect(new URL(fetchInputToUrl(url)).searchParams.get("from")).toBe("2026-07-01");
  });

  it("returns response metadata without changing the legacy data result", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockResponse({
        body: {
          success: true,
          message: "ok",
          data: { id: "p1", name: "Tai nghe" },
          errorCode: null,
          timestamp: "2026-05-15T00:00:00Z",
          meta: { cacheStatus: "hit", stale: false },
        },
        headers: { "x-request-id": "request-1" },
      }),
    );

    const result = await api.getWithMeta("/products/v2", productSchema, undefined, { auth: false });

    expect(result.data).toEqual({ id: "p1", name: "Tai nghe" });
    expect(result.meta).toMatchObject({
      cacheStatus: "hit",
      stale: false,
      requestId: "request-1",
    });
    expect(result.status).toBe(200);
  });

  it("reuses a public GET body when the server returns 304", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockResponse({
        body: {
          success: true,
          message: "ok",
          data: { id: "p1", name: "Tai nghe" },
          errorCode: null,
          timestamp: "2026-05-15T00:00:00Z",
        },
        headers: { etag: '"product-v1"' },
      }),
    );
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 304 }));

    const initial = await api.getWithMeta("/products/v2", productSchema, undefined, {
      auth: false,
    });
    expect(initial.headers.get("etag")).toBe('"product-v1"');
    const result = await api.getWithMeta("/products/v2", productSchema, undefined, {
      auth: false,
    });

    const secondHeaders = fetchSpy.mock.calls[1][1]?.headers as Record<string, string>;
    expect(secondHeaders["If-None-Match"]).toBe('"product-v1"');
    expect(result).not.toBeInstanceOf(ApiError);
    expect(result.data).toEqual({ id: "p1", name: "Tai nghe" });
    expect(result.status).toBe(304);
  });

  it("waits for an in-flight same-tab refresh before retrying a second authenticated 401", async () => {
    liveToken = "old-jwt";
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    interface RefreshGate {
      promise: Promise<{
        accessToken: string;
        accessExpiresAt: number;
      }>;
      resolve: ((value: { accessToken: string; accessExpiresAt: number }) => void) | null;
    }

    const refreshGate: RefreshGate = {
      promise: Promise.resolve({
        accessToken: "unreachable",
        accessExpiresAt: 0,
      }),
      resolve: null,
    };

    refreshGate.promise = new Promise<{
      accessToken: string;
      accessExpiresAt: number;
    }>((resolve) => {
      refreshGate.resolve = resolve;
    });
    refreshTokensMock.mockImplementation(() => refreshGate.promise);

    fetchSpy.mockResolvedValueOnce(new Response("unauthorized", { status: 401 }));
    fetchSpy.mockResolvedValueOnce(new Response("unauthorized", { status: 401 }));
    fetchSpy.mockResolvedValueOnce(
      mockResponse({
        body: {
          success: true,
          message: "ok",
          data: { id: "p1", name: "Primary" },
          errorCode: null,
          timestamp: "2026-05-15T00:00:00Z",
        },
      }),
    );
    fetchSpy.mockResolvedValueOnce(
      mockResponse({
        body: {
          success: true,
          message: "ok",
          data: { id: "p2", name: "Secondary" },
          errorCode: null,
          timestamp: "2026-05-15T00:00:00Z",
        },
      }),
    );

    const first = request({
      method: "GET",
      path: "/me/primary",
      schema: productSchema,
    });
    const second = request({
      method: "GET",
      path: "/me/secondary",
      schema: productSchema,
    });

    await waitFor(() => {
      expect(refreshTokensMock).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(refreshGate.resolve).not.toBeNull();
    });

    const releaseRefresh = refreshGate.resolve;
    if (!releaseRefresh) {
      throw new Error("Expected the refresh resolver to be captured");
    }

    releaseRefresh({
      accessToken: "new-jwt",
      accessExpiresAt: Date.now() + 60_000,
    });

    await expect(Promise.all([first, second])).resolves.toEqual([
      { id: "p1", name: "Primary" },
      { id: "p2", name: "Secondary" },
    ]);
    expect(fetchSpy).toHaveBeenCalledTimes(4);
    expect(refreshTokensMock).toHaveBeenCalledTimes(1);
    expect(dispatchSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "auth:unauthorized" }),
    );
  });

  it("retries parallel old-token requests after one successful same-tab refresh", async () => {
    liveToken = "old-jwt";
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    const refreshGate: {
      promise: Promise<TokenSet>;
      resolve: ((value: TokenSet) => void) | null;
    } = {
      promise: Promise.resolve({ accessToken: "unreachable", accessExpiresAt: 0 }),
      resolve: null,
    };
    refreshGate.promise = new Promise<TokenSet>((resolve) => {
      refreshGate.resolve = resolve;
    });
    const secondaryInitialResponse: {
      promise: Promise<Response>;
      resolve: ((value: Response) => void) | null;
    } = {
      promise: Promise.resolve(new Response("unreachable", { status: 500 })),
      resolve: null,
    };
    secondaryInitialResponse.promise = new Promise<Response>((resolve) => {
      secondaryInitialResponse.resolve = resolve;
    });

    refreshTokensMock
      .mockImplementationOnce(() => refreshGate.promise)
      .mockRejectedValueOnce(new Error("A second refresh must not be attempted"));
    fetchSpy.mockImplementation((input, init) => {
      const url = fetchInputToUrl(input);
      const headers = init?.headers as Record<string, string>;
      const isOldToken = headers.Authorization === "Bearer old-jwt";

      if (url.endsWith("/me/primary")) {
        return Promise.resolve(
          isOldToken
            ? new Response("unauthorized", { status: 401 })
            : mockResponse({
                body: {
                  success: true,
                  message: "ok",
                  data: { id: "p1", name: "Primary" },
                  errorCode: null,
                  timestamp: "2026-05-15T00:00:00Z",
                },
              }),
        );
      }

      if (url.endsWith("/me/secondary")) {
        return isOldToken
          ? secondaryInitialResponse.promise
          : Promise.resolve(
              mockResponse({
                body: {
                  success: true,
                  message: "ok",
                  data: { id: "p2", name: "Secondary" },
                  errorCode: null,
                  timestamp: "2026-05-15T00:00:00Z",
                },
              }),
            );
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    const first = request({ method: "GET", path: "/me/primary", schema: productSchema });
    const second = request({ method: "GET", path: "/me/secondary", schema: productSchema });

    await waitFor(() => {
      expect(refreshTokensMock).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(refreshGate.resolve).not.toBeNull();
    });

    const releaseRefresh = refreshGate.resolve;
    if (!releaseRefresh) throw new Error("Expected the refresh resolver to be captured");
    releaseRefresh({ accessToken: "new-jwt", accessExpiresAt: Date.now() + 60_000 });
    await expect(first).resolves.toEqual({ id: "p1", name: "Primary" });

    const releaseSecondary401 = secondaryInitialResponse.resolve;
    if (!releaseSecondary401) {
      throw new Error("Expected the secondary 401 resolver to be captured");
    }
    releaseSecondary401(new Response("unauthorized", { status: 401 }));

    await expect(second).resolves.toEqual({ id: "p2", name: "Secondary" });
    expect(fetchSpy).toHaveBeenCalledTimes(4);
    expect(refreshTokensMock).toHaveBeenCalledTimes(1);
    expect(dispatchSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "auth:unauthorized" }),
    );
  });
});
