/**
 * Unit tests for native-auth.ts — focused on the CSRF double-submit fix.
 *
 * <p>user-service's {@code CsrfProtectionFilter} requires the SPA to send the
 * {@code X-CSRF-Token} header on {@code POST /auth/refresh} and
 * {@code POST /auth/logout}. The header value must match the
 * {@code vnshop_csrf} cookie. These tests pin that contract: the helper
 * reads the cookie, attaches the header on the two protected endpoints, and
 * does <em>not</em> attach it on login (which is excluded by the filter).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  csrfAuthHeader,
  passwordLogin,
  readCookieValue,
  refreshTokens,
  revokeTokens,
  setTokenRefreshHandler,
} from "./native-auth";

const CSRF_TOKEN_VALUE = "test-csrf-token-abc123";

function setDocumentCookie(cookieString: string): void {
  // happy-dom lets us stub document.cookie via a getter
  Object.defineProperty(document, "cookie", {
    value: cookieString,
    writable: true,
    configurable: true,
  });
}

function getLastFetchCall(): { url: string; init: RequestInit } {
  // `fetchMock` is the spy we install in beforeEach; assert against that
  // directly so we never depend on the global having our stub attached.
  const calls = fetchMock.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  const last = calls[calls.length - 1];
  return { url: last[0] as string, init: last[1] as RequestInit };
}

let fetchMock: ReturnType<typeof vi.fn>;

function getHeadersAsObject(init: RequestInit): Record<string, string> {
  const headers = init.headers;
  if (!headers) return {};
  if (headers instanceof Headers) {
    const out: Record<string, string> = {};
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  if (Array.isArray(headers)) {
    const out: Record<string, string> = {};
    for (const [key, value] of headers) {
      out[key] = value;
    }
    return out;
  }
  return headers as Record<string, string>;
}

function mockFetchReturningAuthSession(): void {
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({
        success: true,
        data: { accessToken: "fake-access-token", accessExpiresIn: 900 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );
}

beforeEach(() => {
  // Spy on the real global fetch. vi.restoreAllMocks() in afterEach
  // restores the original implementation so this test does not pollute
  // other test files that rely on the real fetch.
  fetchMock = vi.fn();
  vi.spyOn(globalThis, "fetch").mockImplementation(fetchMock);
  setDocumentCookie("");
  setTokenRefreshHandler(null);
});

afterEach(() => {
  setTokenRefreshHandler(null);
  vi.restoreAllMocks();
});

describe("readCookieValue", () => {
  it("returns the value of the named cookie", () => {
    setDocumentCookie(`${CSRF_COOKIE_NAME}=${CSRF_TOKEN_VALUE}; other=foo`);
    expect(readCookieValue(CSRF_COOKIE_NAME)).toBe(CSRF_TOKEN_VALUE);
  });

  it("returns an empty string when the cookie is absent", () => {
    setDocumentCookie("session=abc; theme=dark");
    expect(readCookieValue(CSRF_COOKIE_NAME)).toBe("");
  });

  it("returns an empty string when document.cookie is empty", () => {
    setDocumentCookie("");
    expect(readCookieValue(CSRF_COOKIE_NAME)).toBe("");
  });

  it("decodes URI-encoded values", () => {
    setDocumentCookie(`${CSRF_COOKIE_NAME}=hello%20world`);
    expect(readCookieValue(CSRF_COOKIE_NAME)).toBe("hello world");
  });
});

describe("csrfAuthHeader", () => {
  it("returns the CSRF header when the cookie is present", () => {
    setDocumentCookie(`${CSRF_COOKIE_NAME}=${CSRF_TOKEN_VALUE}`);
    expect(csrfAuthHeader()).toEqual({ [CSRF_HEADER_NAME]: CSRF_TOKEN_VALUE });
  });

  it("returns undefined when the cookie is missing", () => {
    setDocumentCookie("other=foo");
    expect(csrfAuthHeader()).toBeUndefined();
  });
});

describe("refreshTokens", () => {
  it("delegates browser-session refresh to the active OIDC client", async () => {
    const tokenSet = {
      accessToken: "oidc-access-token",
      accessExpiresAt: Date.now() + 60_000,
    };
    const oidcRefresh = vi.fn().mockResolvedValue(tokenSet);
    setTokenRefreshHandler(oidcRefresh);

    await expect(refreshTokens()).resolves.toEqual(tokenSet);

    expect(oidcRefresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("attaches the X-CSRF-Token header on /auth/refresh", async () => {
    setDocumentCookie(`${CSRF_COOKIE_NAME}=${CSRF_TOKEN_VALUE}`);
    mockFetchReturningAuthSession();

    await refreshTokens();

    const { url, init } = getLastFetchCall();
    expect(url).toContain("/auth/refresh");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    const headers = getHeadersAsObject(init);
    expect(headers[CSRF_HEADER_NAME]).toBe(CSRF_TOKEN_VALUE);
  });

  it("sends a request without the CSRF header when the cookie is missing (filter will 403)", async () => {
    setDocumentCookie("");
    mockFetchReturningAuthSession();

    await refreshTokens();

    const { url, init } = getLastFetchCall();
    expect(url).toContain("/auth/refresh");
    const headers = getHeadersAsObject(init);
    expect(headers[CSRF_HEADER_NAME]).toBeUndefined();
  });
});

describe("revokeTokens", () => {
  it("attaches the X-CSRF-Token header on /auth/logout", async () => {
    setDocumentCookie(`${CSRF_COOKIE_NAME}=${CSRF_TOKEN_VALUE}`);
    mockFetchReturningAuthSession();

    await revokeTokens();

    const { url, init } = getLastFetchCall();
    expect(url).toContain("/auth/logout");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    const headers = getHeadersAsObject(init);
    expect(headers[CSRF_HEADER_NAME]).toBe(CSRF_TOKEN_VALUE);
  });
});

describe("passwordLogin", () => {
  it("does NOT attach the X-CSRF-Token header on /auth/login (excluded by filter)", async () => {
    setDocumentCookie(`${CSRF_COOKIE_NAME}=${CSRF_TOKEN_VALUE}`);
    mockFetchReturningAuthSession();

    await passwordLogin("user", "pass");

    const { url, init } = getLastFetchCall();
    expect(url).toContain("/auth/login");
    expect(init.method).toBe("POST");
    const headers = getHeadersAsObject(init);
    expect(headers[CSRF_HEADER_NAME]).toBeUndefined();
    // Sanity: the body Content-Type is still set for the JSON payload
    expect(headers["Content-Type"]).toBe("application/json");
  });
});
