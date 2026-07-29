import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../lib/api/envelope";
import type { JwtClaims, TokenSet } from "../lib/auth/native-auth";

const mocks = vi.hoisted(() => ({
  decodeJwt: vi.fn(),
  setLiveTokenSet: vi.fn(),
  registerUser: vi.fn(),
  passwordLogin: vi.fn(),
  refreshTokens: vi.fn(),
  revokeTokens: vi.fn(),
  accessTokenRefreshBufferMs: 60_000,
}));

vi.mock("../lib/auth/native-auth", () => ({
  decodeJwt: (token: string) => mocks.decodeJwt(token),
  setLiveTokenSet: (tokenSet: TokenSet | null) => mocks.setLiveTokenSet(tokenSet),
  passwordLogin: (...args: unknown[]) => mocks.passwordLogin(...args),
  refreshTokens: (...args: unknown[]) => mocks.refreshTokens(...args),
  revokeTokens: (...args: unknown[]) => mocks.revokeTokens(...args),
  ACCESS_TOKEN_REFRESH_BUFFER_MS: mocks.accessTokenRefreshBufferMs,
  isAccessTokenRefreshDue: (tokenSet: { accessExpiresAt: number }) =>
    tokenSet.accessExpiresAt - Date.now() <= mocks.accessTokenRefreshBufferMs,
  AuthError: class AuthError extends Error {
    constructor(
      readonly statusCode: number,
      readonly errorCode: string,
      message: string,
    ) {
      super(message);
    }
  },
}));

vi.mock("../lib/api/endpoints/auth", () => ({
  registerUser: (...args: unknown[]) => mocks.registerUser(...args),
}));

import { useAuth, useHasRole } from "./auth-context";
import { AuthProvider } from "./use-auth";

const tokenSet: TokenSet = {
  accessToken: "access-token",
  accessExpiresAt: Date.now() + 3_600_000,
};
const claims: JwtClaims = {
  sub: "user-123",
  email: "buyer@vnshop.invalid",
  given_name: "Buyer",
  realm_access: { roles: ["BUYER", "offline_access"] },
};

function Wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe("AuthProvider native session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.refreshTokens.mockResolvedValue(tokenSet);
    mocks.passwordLogin.mockResolvedValue(tokenSet);
    mocks.decodeJwt.mockReturnValue(claims);
    mocks.registerUser.mockResolvedValue(undefined);
    mocks.revokeTokens.mockResolvedValue(undefined);
  });

  it("initializes from validated runtime config and exposes token claims", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(mocks.refreshTokens).toHaveBeenCalledTimes(1);
    expect(result.current.authenticated).toBe(true);
    expect(result.current.profile?.email).toBe("buyer@vnshop.invalid");
    expect(result.current.roles).toEqual(["BUYER"]);
    expect(mocks.setLiveTokenSet).toHaveBeenCalledWith(tokenSet);
  });

  it("becomes ready and unauthenticated when no cookie session exists", async () => {
    mocks.refreshTokens.mockRejectedValueOnce(new Error("no session"));
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.authenticated).toBe(false);
    expect(result.current.token).toBeUndefined();
  });

  it("logs in through the user-service cookie boundary", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(async () => result.current.loginWithPassword("buyer1", "test"));

    expect(mocks.passwordLogin).toHaveBeenCalledWith("buyer1", "test");
    expect(mocks.setLiveTokenSet).toHaveBeenLastCalledWith(tokenSet);
  });

  it("registers through the compatible API without creating a password session", async () => {
    const input = {
      email: "new@vnshop.invalid",
      password: "StrongPassword123!",
      firstName: "New",
      lastName: "Buyer",
    };
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(async () => result.current.register(input));

    expect(mocks.registerUser).toHaveBeenCalledWith(input);
    expect(mocks.passwordLogin).not.toHaveBeenCalled();
  });

  it("preserves API registration errors as AuthError details", async () => {
    mocks.registerUser.mockRejectedValueOnce(
      new ApiError(409, "email_taken", "Email already exists"),
    );
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    await expect(
      result.current.register({
        email: "existing@vnshop.invalid",
        password: "StrongPassword123!",
        firstName: "Existing",
        lastName: "Buyer",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      errorCode: "email_taken",
      message: "Email already exists",
    });
  });

  it("refreshes the cookie session and performs best-effort logout", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.logout());

    expect(mocks.revokeTokens).toHaveBeenCalledTimes(1);
    expect(result.current.authenticated).toBe(false);
  });

  it("does not let an in-flight refresh restore a session after logout", async () => {
    const expiringTokenSet = { ...tokenSet, accessExpiresAt: Date.now() + 30_000 };
    mocks.refreshTokens.mockResolvedValueOnce(expiringTokenSet);
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    let resolveRefresh!: (value: TokenSet) => void;
    const pendingRefresh = new Promise<TokenSet>((resolve) => {
      resolveRefresh = resolve;
    });
    mocks.refreshTokens.mockReturnValueOnce(pendingRefresh);

    act(() => window.dispatchEvent(new Event("focus")));
    expect(mocks.refreshTokens).toHaveBeenCalledTimes(2);

    act(() => result.current.logout());
    await act(async () => resolveRefresh(tokenSet));

    await waitFor(() => expect(result.current.authenticated).toBe(false));
    expect(mocks.setLiveTokenSet).toHaveBeenLastCalledWith(null);
  });

  it("does not refresh on focus or visibility changes while the JWT is fresh", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(mocks.refreshTokens).toHaveBeenCalledTimes(1);
  });

  it("reports allowed roles only", async () => {
    const { result } = renderHook(() => useHasRole("BUYER"), { wrapper: Wrapper });
    await waitFor(() => expect(result.current).toBe(true));
  });
});
