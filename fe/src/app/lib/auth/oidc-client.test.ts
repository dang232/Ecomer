import { beforeEach, describe, expect, it, vi } from "vitest";

const { keycloak, KeycloakMock } = vi.hoisted(() => {
  const client = {
    authenticated: false,
    token: undefined as string | undefined,
    tokenParsed: undefined as { exp?: number } | undefined,
    init: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    updateToken: vi.fn(),
  };
  return {
    keycloak: client,
    KeycloakMock: vi.fn(function KeycloakMockImplementation() {
      return client;
    }),
  };
});

vi.mock("keycloak-js", () => ({ default: KeycloakMock }));

import { createOidcClient } from "./oidc-client";

const config = {
  issuerUri: "https://auth.vnshop.invalid/realms/vnshop",
  callbackUri: "https://shop.vnshop.invalid/auth/callback",
  logoutUri: "https://shop.vnshop.invalid/",
  clientId: "vnshop-web",
};

describe("OIDC browser client", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    keycloak.authenticated = false;
    keycloak.token = undefined;
    keycloak.tokenParsed = undefined;
    keycloak.init.mockResolvedValue(false);
    keycloak.login.mockResolvedValue(undefined);
    keycloak.logout.mockResolvedValue(undefined);
    keycloak.updateToken.mockResolvedValue(false);
    window.history.replaceState({}, "", "/");
  });

  it("uses authorization code flow with PKCE S256 and the exact callback", async () => {
    const client = createOidcClient(config);

    await client.init();

    expect(KeycloakMock).toHaveBeenCalledWith({
      url: "https://auth.vnshop.invalid",
      realm: "vnshop",
      clientId: "vnshop-web",
    });
    expect(keycloak.init).toHaveBeenCalledWith({
      checkLoginIframe: false,
      flow: "standard",
      pkceMethod: "S256",
      redirectUri: config.callbackUri,
    });
  });

  it("keeps the token in memory and derives its expiry from verified claims", async () => {
    keycloak.authenticated = true;
    keycloak.token = "header.payload.signature";
    keycloak.tokenParsed = { exp: 1_900_000_000 };
    keycloak.init.mockResolvedValue(true);

    const tokenSet = await createOidcClient(config).init();

    expect(tokenSet).toEqual({
      accessToken: "header.payload.signature",
      accessExpiresAt: 1_900_000_000_000,
    });
    expect(localStorage.length).toBe(0);
  });

  it("stores only a safe return path and delegates login to Keycloak", () => {
    const client = createOidcClient(config);

    client.login("/orders?status=PAID", "google");

    expect(sessionStorage.getItem("vnshop:oidc-return-path")).toBe("/orders?status=PAID");
    expect(keycloak.login).toHaveBeenCalledWith({
      idpHint: "google",
      redirectUri: config.callbackUri,
    });
  });

  it("rejects an external return target", () => {
    const client = createOidcClient(config);

    client.login("https://attacker.invalid/steal");

    expect(sessionStorage.getItem("vnshop:oidc-return-path")).toBe("/");
  });

  it("restores a safe return path after the callback", async () => {
    window.history.replaceState({}, "", "/auth/callback?code=abc&state=xyz");
    sessionStorage.setItem("vnshop:oidc-return-path", "/checkout");
    keycloak.authenticated = true;
    keycloak.token = "token";
    keycloak.tokenParsed = { exp: 1_900_000_000 };
    keycloak.init.mockResolvedValue(true);

    await createOidcClient(config).init();

    expect(window.location.pathname).toBe("/checkout");
    expect(sessionStorage.getItem("vnshop:oidc-return-path")).toBeNull();
  });

  it("refreshes through Keycloak and logs out to the exact configured URI", async () => {
    keycloak.authenticated = true;
    keycloak.token = "refreshed-token";
    keycloak.tokenParsed = { exp: 1_900_000_001 };
    keycloak.updateToken.mockResolvedValue(true);
    const client = createOidcClient(config);

    await expect(client.refresh()).resolves.toEqual({
      accessToken: "refreshed-token",
      accessExpiresAt: 1_900_000_001_000,
    });
    client.logout();

    expect(keycloak.updateToken).toHaveBeenCalledWith(30);
    expect(keycloak.logout).toHaveBeenCalledWith({ redirectUri: config.logoutUri });
  });
});
