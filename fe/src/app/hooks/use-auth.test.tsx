import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../lib/api/envelope";
import type { JwtClaims, TokenSet } from "../lib/auth/native-auth";

const mocks = vi.hoisted(() => ({
  createOidcClient: vi.fn(),
  decodeJwt: vi.fn(),
  setLiveTokenSet: vi.fn(),
  setTokenRefreshHandler: vi.fn(),
  registerUser: vi.fn(),
  init: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("../lib/auth/oidc-client", () => ({
  createOidcClient: (...args: unknown[]) => mocks.createOidcClient(...args),
}));

vi.mock("../lib/auth/native-auth", () => ({
  decodeJwt: (token: string) => mocks.decodeJwt(token),
  setLiveTokenSet: (tokenSet: TokenSet | null) => mocks.setLiveTokenSet(tokenSet),
  setTokenRefreshHandler: (handler: (() => Promise<TokenSet>) | null) =>
    mocks.setTokenRefreshHandler(handler),
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

vi.mock("./use-app-config", () => ({
  useAppConfig: () => ({
    auth: {
      issuerUri: "https://auth.vnshop.invalid/realms/vnshop",
      callbackUri: "https://shop.vnshop.invalid/auth/callback",
      logoutUri: "https://shop.vnshop.invalid/",
      clientId: "vnshop-web",
    },
  }),
}));

import { AuthProvider, useAuth, useHasRole } from "./use-auth";

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

describe("AuthProvider OIDC session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createOidcClient.mockReturnValue({
      init: mocks.init,
      login: mocks.login,
      logout: mocks.logout,
      refresh: mocks.refresh,
    });
    mocks.init.mockResolvedValue(tokenSet);
    mocks.refresh.mockResolvedValue(tokenSet);
    mocks.decodeJwt.mockReturnValue(claims);
    mocks.registerUser.mockResolvedValue(undefined);
  });

  it("initializes from validated runtime config and exposes token claims", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(mocks.createOidcClient).toHaveBeenCalledWith({
      issuerUri: "https://auth.vnshop.invalid/realms/vnshop",
      callbackUri: "https://shop.vnshop.invalid/auth/callback",
      logoutUri: "https://shop.vnshop.invalid/",
      clientId: "vnshop-web",
    });
    expect(result.current.authenticated).toBe(true);
    expect(result.current.profile?.email).toBe("buyer@vnshop.invalid");
    expect(result.current.roles).toEqual(["BUYER"]);
    expect(mocks.setLiveTokenSet).toHaveBeenCalledWith(tokenSet);
  });

  it("becomes ready and unauthenticated when no OIDC session exists", async () => {
    mocks.init.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.authenticated).toBe(false);
    expect(result.current.token).toBeUndefined();
  });

  it("delegates sign-in and identity-provider hints to Keycloak", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.login("/orders"));
    act(() => result.current.beginOAuthLogin("google", "/profile"));

    expect(mocks.login).toHaveBeenNthCalledWith(1, "/orders");
    expect(mocks.login).toHaveBeenNthCalledWith(2, "/profile", "google");
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
    expect(mocks.login).not.toHaveBeenCalled();
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

  it("registers OIDC refresh for API retries and performs exact-provider logout", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));
    const refreshHandler = mocks.setTokenRefreshHandler.mock.calls.find(
      ([handler]) => typeof handler === "function",
    )?.[0] as (() => Promise<TokenSet>) | undefined;

    let refreshed: TokenSet | undefined;
    await act(async () => {
      refreshed = await refreshHandler?.();
    });
    expect(refreshed).toEqual(tokenSet);
    act(() => result.current.logout());

    expect(mocks.refresh).toHaveBeenCalled();
    expect(mocks.logout).toHaveBeenCalledTimes(1);
    expect(result.current.authenticated).toBe(false);
  });

  it("reports allowed roles only", async () => {
    const { result } = renderHook(() => useHasRole("BUYER"), { wrapper: Wrapper });
    await waitFor(() => expect(result.current).toBe(true));
  });
});
