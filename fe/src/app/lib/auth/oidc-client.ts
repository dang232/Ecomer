import Keycloak from "keycloak-js";

import type { TokenSet } from "./native-auth";

const RETURN_PATH_KEY = "vnshop:oidc-return-path";

export interface OidcConfig {
  issuerUri: string;
  callbackUri: string;
  logoutUri: string;
  clientId: string;
}

export interface OidcClient {
  init(): Promise<TokenSet | null>;
  login(returnPath?: string, idpHint?: string): void;
  logout(): void;
  refresh(): Promise<TokenSet>;
}

function safeReturnPath(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const parsed = new URL(value, window.location.origin);
    return parsed.origin === window.location.origin
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : "/";
  } catch {
    return "/";
  }
}

function keycloakConfig(config: OidcConfig) {
  const issuer = new URL(config.issuerUri);
  const realmMarker = "/realms/";
  const markerIndex = issuer.pathname.lastIndexOf(realmMarker);
  if (markerIndex < 0) throw new Error("OIDC issuer must identify a Keycloak realm");
  const realm = issuer.pathname.slice(markerIndex + realmMarker.length);
  if (!realm || realm.includes("/")) throw new Error("OIDC issuer realm is invalid");
  const basePath = issuer.pathname.slice(0, markerIndex);
  return {
    url: `${issuer.origin}${basePath}`,
    realm,
    clientId: config.clientId,
  };
}

class KeycloakOidcClient implements OidcClient {
  private readonly keycloak: Keycloak;
  private initPromise: Promise<TokenSet | null> | null = null;

  constructor(private readonly config: OidcConfig) {
    this.keycloak = new Keycloak(keycloakConfig(config));
  }

  init(): Promise<TokenSet | null> {
    if (!this.initPromise) {
      this.initPromise = this.initialize();
    }
    return this.initPromise;
  }

  private async initialize(): Promise<TokenSet | null> {
    const authenticated = await this.keycloak.init({
      checkLoginIframe: false,
      flow: "standard",
      pkceMethod: "S256",
      redirectUri: this.config.callbackUri,
    });

    if (!authenticated) {
      this.finishCallback("/login?oauthError=oauth_failed");
      return null;
    }

    const tokenSet = this.currentTokenSet();
    this.finishCallback(sessionStorage.getItem(RETURN_PATH_KEY) ?? "/");
    sessionStorage.removeItem(RETURN_PATH_KEY);
    return tokenSet;
  }

  login(returnPath?: string, idpHint?: string): void {
    sessionStorage.setItem(RETURN_PATH_KEY, safeReturnPath(returnPath));
    const options = {
      redirectUri: this.config.callbackUri,
      ...(idpHint ? { idpHint } : {}),
    };
    void this.keycloak.login(options);
  }

  logout(): void {
    sessionStorage.removeItem(RETURN_PATH_KEY);
    void this.keycloak.logout({ redirectUri: this.config.logoutUri });
  }

  async refresh(): Promise<TokenSet> {
    await this.keycloak.updateToken(30);
    return this.currentTokenSet();
  }

  private currentTokenSet(): TokenSet {
    const expiresAt = this.keycloak.tokenParsed?.exp;
    if (!this.keycloak.authenticated || !this.keycloak.token || !expiresAt) {
      throw new Error("OIDC session does not contain a usable access token");
    }
    return {
      accessToken: this.keycloak.token,
      accessExpiresAt: expiresAt * 1000,
    };
  }

  private finishCallback(destination: string): void {
    const callbackPath = new URL(this.config.callbackUri).pathname;
    if (window.location.pathname === callbackPath) {
      window.history.replaceState({}, "", safeReturnPath(destination));
    }
  }
}

export function createOidcClient(config: OidcConfig): OidcClient {
  return new KeycloakOidcClient(config);
}
