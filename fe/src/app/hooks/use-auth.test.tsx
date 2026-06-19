import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../lib/api/envelope";
import { type JwtClaims, type TokenSet } from "../lib/auth/native-auth";
import { AuthProvider, useAuth, useHasRole } from "./use-auth";

// TokenSet is referenced in makeTokenSet() below.

// ---------------------------------------------------------------------------
// Mock implementations
// ---------------------------------------------------------------------------
const refreshTokensMock = vi.fn();
const passwordLoginMock = vi.fn();
const revokeTokensMock = vi.fn();
const registerUserMock = vi.fn();
const decodeJwtMock = vi.fn();

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
vi.mock("../lib/auth/native-auth", () => ({
  passwordLogin: (...args: unknown[]) => passwordLoginMock(...args),
  refreshTokens: () => refreshTokensMock(),
  revokeTokens: () => revokeTokensMock(),
  setLiveTokenSet: () => {},
  decodeJwt: (token: string) => decodeJwtMock(token),
  AuthError: class AuthError extends Error {
    readonly statusCode: number;
    readonly errorCode: string;
    constructor(statusCode: number, errorCode: string, message: string) {
      super(message);
      this.name = "AuthError";
      this.statusCode = statusCode;
      this.errorCode = errorCode;
    }
  },
}));

vi.mock("../lib/api/endpoints/auth", () => ({
  registerUser: (...args: unknown[]) => registerUserMock(...args),
}));

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------
function makeClaims(overrides: Partial<JwtClaims> = {}): JwtClaims {
  return {
    sub: "user-123",
    email: "alice@example.com",
    given_name: "Alice",
    family_name: "Doe",
    preferred_username: "alice",
    realm_access: { roles: ["BUYER", "SELLER"] },
    ...overrides,
  };
}

function makeTokenSet(overrides: Partial<TokenSet> = {}): TokenSet {
  return {
    accessToken: "mock-access-token",
    accessExpiresAt: Date.now() + 3_600_000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Wrapper factory — new client each call so mocks don't bleed between tests
// ---------------------------------------------------------------------------
function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    );
  }
  return { client, Wrapper };
}

// ---------------------------------------------------------------------------
// useAuth + useHasRole — 17 test scenarios
// ---------------------------------------------------------------------------
describe("useAuth + useHasRole", () => {
  beforeEach(() => {
    refreshTokensMock.mockReset();
    passwordLoginMock.mockReset();
    revokeTokensMock.mockReset();
    registerUserMock.mockReset();
    decodeJwtMock.mockReset();

    // decodeJwt returns valid claims for any non-empty token; null for empty
    decodeJwtMock.mockImplementation((token: string): JwtClaims | null => {
      if (!token) return null;
      return makeClaims();
    });

    // Default: refreshTokens resolves with a valid token set
    refreshTokensMock.mockResolvedValue(makeTokenSet());

    // Default: revokeTokens resolves immediately
    revokeTokensMock.mockResolvedValue(undefined);

    // Stub window.location.assign for login() shim tests
    Object.defineProperty(window, "location", {
      value: { assign: vi.fn(), pathname: "/", search: "" },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // A. Rehydrate on mount
  // -------------------------------------------------------------------------
  describe("A. Rehydrate on mount", () => {
    it("A1. exposes ready+authenticated+token+profile when refreshTokens succeeds", async () => {
      const claims = makeClaims({ sub: "user-abc", email: "bob@test.com", given_name: "Bob" });
      refreshTokensMock.mockResolvedValueOnce(makeTokenSet({ accessToken: "token-abc" }));
      decodeJwtMock.mockReturnValueOnce(claims);

      const { Wrapper } = makeWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.ready).toBe(true));
      expect(result.current.authenticated).toBe(true);
      expect(result.current.token).toBe("token-abc");
      expect(result.current.profile?.id).toBe("user-abc");
      expect(result.current.profile?.email).toBe("bob@test.com");
      expect(result.current.profile?.firstName).toBe("Bob");
    });

    it("A2. exposes ready+unauthenticated when refreshTokens rejects", async () => {
      refreshTokensMock.mockRejectedValueOnce(new Error("no session"));

      const { Wrapper } = makeWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.ready).toBe(true));
      expect(result.current.authenticated).toBe(false);
      expect(result.current.token).toBeUndefined();
      expect(result.current.profile).toBeUndefined();
    });

    it("A3. filters roles to BUYER/SELLER/ADMIN only (drops junk roles)", async () => {
      const claims = makeClaims({ realm_access: { roles: ["BUYER", "SELLER", "offline_access", "uma_authorization"] } });
      refreshTokensMock.mockResolvedValueOnce(makeTokenSet());
      decodeJwtMock.mockReturnValueOnce(claims);

      const { Wrapper } = makeWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.ready).toBe(true));
      expect(result.current.roles).toContain("BUYER");
      expect(result.current.roles).toContain("SELLER");
      expect(result.current.roles).not.toContain("offline_access");
      expect(result.current.roles).not.toContain("uma_authorization");
    });
  });

  // -------------------------------------------------------------------------
  // B. loginWithCredentials
  // -------------------------------------------------------------------------
  describe("B. loginWithCredentials", () => {
    it("B1. calls passwordLogin then exposes authenticated+token on success", async () => {
      const tokenSet = makeTokenSet({ accessToken: "login-token-xyz" });
      passwordLoginMock.mockResolvedValueOnce(tokenSet);

      const { Wrapper } = makeWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.ready).toBe(true));

      await act(async () => {
        await result.current.loginWithCredentials("alice@test.com", "Secret123");
      });

      expect(passwordLoginMock).toHaveBeenCalledWith("alice@test.com", "Secret123");
      expect(result.current.authenticated).toBe(true);
      expect(result.current.token).toBe("login-token-xyz");
    });

    it("B2. propagates passwordLogin errors and leaves state unchanged", async () => {
      // Make initial mount reject so the user starts unauthenticated
      refreshTokensMock.mockRejectedValueOnce(new Error("no session"));
      passwordLoginMock.mockRejectedValueOnce(new Error("invalid credentials"));

      const { Wrapper } = makeWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.ready).toBe(true));
      expect(result.current.authenticated).toBe(false);

      await expect(
        act(async () => {
          await result.current.loginWithCredentials("bad@test.com", "wrong");
        }),
      ).rejects.toThrow("invalid credentials");

      expect(result.current.authenticated).toBe(false);
      expect(result.current.token).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // C. register
  // -------------------------------------------------------------------------
  describe("C. register", () => {
    it("C1. calls registerUser then auto-logs in with input.email + input.password", async () => {
      registerUserMock.mockResolvedValueOnce(undefined);
      const loginToken = makeTokenSet({ accessToken: "post-register-token" });
      passwordLoginMock.mockResolvedValueOnce(loginToken);

      const { Wrapper } = makeWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.ready).toBe(true));

      await act(async () => {
        await result.current.register({ email: "newbie@test.com", password: "Pass456", firstName: "New", lastName: "User" });
      });

      expect(registerUserMock).toHaveBeenCalledWith({
        email: "newbie@test.com",
        password: "Pass456",
        firstName: "New",
        lastName: "User",
      });
      expect(passwordLoginMock).toHaveBeenCalledWith("newbie@test.com", "Pass456");
      expect(result.current.authenticated).toBe(true);
      expect(result.current.token).toBe("post-register-token");
    });

    it("C2. wraps ApiError from registerUser into AuthError(statusCode, errorCode, message)", async () => {
      registerUserMock.mockRejectedValueOnce(new ApiError(409, "email_conflict", "Email already in use"));

      const { Wrapper } = makeWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.ready).toBe(true));

      // Capture the thrown error without using act().rejects (which swallows it)
      let thrown: unknown;
      try {
        await act(async () => {
          await result.current.register({ email: "dup@test.com", password: "Pass789", firstName: "Dupe", lastName: "User" });
        });
      } catch (e) {
        thrown = e;
      }

      expect(thrown).toBeDefined();
      const err = thrown as Error & { statusCode?: number; errorCode?: string };
      expect(err.message).toBe("Email already in use");
      expect(err.statusCode).toBe(409);
      expect(err.errorCode).toBe("email_conflict");
    });

    it("C2b. non-ApiError from registerUser passes through unchanged", async () => {
      const err = new Error("network failure");
      registerUserMock.mockRejectedValueOnce(err);

      const { Wrapper } = makeWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.ready).toBe(true));

      await expect(
        act(async () => {
          await result.current.register({ email: "fail@test.com", password: "Pass", firstName: "F", lastName: "L" });
        }),
      ).rejects.toThrow("network failure");
    });

    it("C3. rejects when auto-login after successful register fails", async () => {
      // Start unauthenticated so we can verify the state after the failure
      refreshTokensMock.mockRejectedValueOnce(new Error("no session"));
      registerUserMock.mockResolvedValueOnce(undefined);
      passwordLoginMock.mockRejectedValueOnce(new Error("login after register failed"));

      const { Wrapper } = makeWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.ready).toBe(true));
      expect(result.current.authenticated).toBe(false);

      await expect(
        act(async () => {
          await result.current.register({ email: "autofail@test.com", password: "Pass999", firstName: "Auto", lastName: "Fail" });
        }),
      ).rejects.toThrow("login after register failed");

      expect(result.current.authenticated).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // D. logout
  // -------------------------------------------------------------------------
  describe("D. logout", () => {
    it("D1. calls revokeTokens then clears token — unauthenticated state", async () => {
      const tokenSet = makeTokenSet({ accessToken: "session-token" });
      refreshTokensMock.mockResolvedValueOnce(tokenSet);

      const { Wrapper } = makeWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.authenticated).toBe(true));

      act(() => {
        result.current.logout();
      });

      expect(revokeTokensMock).toHaveBeenCalledTimes(1);
      expect(result.current.authenticated).toBe(false);
      expect(result.current.token).toBeUndefined();
      expect(result.current.profile).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // E. login (back-compat shim)
  // -------------------------------------------------------------------------
  describe("E. login (back-compat shim)", () => {
    it("E1. calls window.location.assign with /login?next=<encoded path> when redirectTo given", async () => {
      const { Wrapper } = makeWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.ready).toBe(true));

      act(() => {
        result.current.login("/admin/dashboard");
      });

      expect(window.location.assign).toHaveBeenCalledWith("/login?next=%2Fadmin%2Fdashboard");
    });

    it("E2. falls back to current window.location.pathname+search when called with no arg", async () => {
      Object.defineProperty(window, "location", {
        value: { assign: vi.fn(), pathname: "/products", search: "?q=iphone" },
        writable: true,
        configurable: true,
      });

      const { Wrapper } = makeWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.ready).toBe(true));

      act(() => {
        result.current.login();
      });

      expect(window.location.assign).toHaveBeenCalledWith("/login?next=%2Fproducts%3Fq%3Diphone");
    });
  });

  // -------------------------------------------------------------------------
  // F. Cross-tab / F5 recovery
  // -------------------------------------------------------------------------
  describe("F. Cross-tab / F5 recovery", () => {
    // happy-dom's `document.hidden` is not configurable by default but
    // Object.defineProperty DOES work on it once configurable:true is set.
    // We override the getter, then restore the original descriptor after each
    // test. (Earlier draft used `vi.stubGlobal("document", ...)` which
    // clobbered the entire DOM tree and broke subsequent renders.)
    let originalDescriptor: PropertyDescriptor | undefined;

    function setDocumentHidden(value: boolean) {
      if (originalDescriptor === undefined) {
        originalDescriptor = Object.getOwnPropertyDescriptor(document, "hidden");
      }
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => value,
      });
    }

    afterEach(() => {
      if (originalDescriptor) {
        Object.defineProperty(document, "hidden", originalDescriptor);
        originalDescriptor = undefined;
      }
    });

    it("F1. visibilitychange calls refreshTokens when document is visible and no token set", async () => {
      refreshTokensMock.mockResolvedValueOnce(makeTokenSet()); // initial mount

      const { Wrapper } = makeWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.ready).toBe(true));

      // Clear token so tokenSet is null
      act(() => {
        window.dispatchEvent(new Event("auth:unauthorized"));
      });
      await waitFor(() => expect(result.current.authenticated).toBe(false));

      const callsBefore = refreshTokensMock.mock.calls.length;

      // document.hidden=false, dispatch visibilitychange
      setDocumentHidden(false);
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });

      // The void-async handler eventually calls refreshTokens() and the
      // resolved token set propagates through applyTokenSet.
      await waitFor(() =>
        expect(refreshTokensMock.mock.calls.length).toBeGreaterThan(callsBefore),
      );
      await waitFor(() => expect(result.current.authenticated).toBe(true));
    });

    it("F1b. visibilitychange short-circuits when tokenSet is already present", async () => {
      const tokenSet = makeTokenSet({ accessToken: "already-logged-in" });
      refreshTokensMock.mockResolvedValue(tokenSet);

      const { Wrapper } = makeWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.authenticated).toBe(true));

      const callCountBefore = refreshTokensMock.mock.calls.length;

      setDocumentHidden(true);
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });

      // Yield so any microtask the handler queued could land — it must not,
      // because tokenSet is present and the handler short-circuits.
      await new Promise((r) => setTimeout(r, 20));
      expect(refreshTokensMock).toHaveBeenCalledTimes(callCountBefore);
      expect(result.current.token).toBe("already-logged-in");
    });

    it("F2. focus event calls refreshTokens when no token set", async () => {
      refreshTokensMock.mockResolvedValueOnce(makeTokenSet()); // initial mount

      const { Wrapper } = makeWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.ready).toBe(true));

      // Clear token
      act(() => {
        window.dispatchEvent(new Event("auth:unauthorized"));
      });
      await waitFor(() => expect(result.current.authenticated).toBe(false));

      const callsBefore = refreshTokensMock.mock.calls.length;

      // Dispatch focus — the guard check passes (document.hidden=false, tokenSet=null)
      act(() => {
        window.dispatchEvent(new Event("focus"));
      });

      await waitFor(() =>
        expect(refreshTokensMock.mock.calls.length).toBeGreaterThan(callsBefore),
      );
    });
  });

  // -------------------------------------------------------------------------
  // G. unauthorized event listener
  // -------------------------------------------------------------------------
  describe("G. unauthorized event listener", () => {
    it("G1. dispatches auth:unauthorized on window to clear the token set", async () => {
      const tokenSet = makeTokenSet({ accessToken: "pre-revoke-token" });
      refreshTokensMock.mockResolvedValueOnce(tokenSet);

      const { Wrapper } = makeWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.authenticated).toBe(true));
      expect(result.current.token).toBe("pre-revoke-token");

      act(() => {
        window.dispatchEvent(new Event("auth:unauthorized"));
      });

      expect(result.current.authenticated).toBe(false);
      expect(result.current.token).toBeUndefined();
      expect(result.current.profile).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // H. useHasRole
  // -------------------------------------------------------------------------
  describe("H. useHasRole", () => {
    it("H1. returns true when role is in roles, false when not", async () => {
      // Override decodeJwtMock for this test to return BUYER+ADMIN only (no SELLER)
      decodeJwtMock.mockImplementation((token: string): JwtClaims | null => {
        if (!token) return null;
        return makeClaims({ realm_access: { roles: ["BUYER", "ADMIN"] } });
      });

      const { Wrapper: wBuyer } = makeWrapper();
      const { Wrapper: wSeller } = makeWrapper();
      const { Wrapper: wAdmin } = makeWrapper();

      const { result: resultBuyer } = renderHook(() => useHasRole("BUYER"), { wrapper: wBuyer });
      const { result: resultSeller } = renderHook(() => useHasRole("SELLER"), { wrapper: wSeller });
      const { result: resultAdmin } = renderHook(() => useHasRole("ADMIN"), { wrapper: wAdmin });

      await waitFor(() => expect(resultBuyer.current).toBeDefined());
      await waitFor(() => expect(resultSeller.current).toBeDefined());
      await waitFor(() => expect(resultAdmin.current).toBeDefined());

      expect(resultBuyer.current).toBe(true);
      expect(resultSeller.current).toBe(false); // not in the ["BUYER", "ADMIN"] override
      expect(resultAdmin.current).toBe(true);
    });
  });
});