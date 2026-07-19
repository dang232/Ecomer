/* eslint-disable react-refresh/only-export-components -- provider and hooks share one public module. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { registerUser, type RegisterInput } from "../lib/api/endpoints/auth";
import { ApiError } from "../lib/api/envelope";
import {
  AuthError,
  decodeJwt,
  setLiveTokenSet,
  setTokenRefreshHandler,
  type JwtClaims,
  type TokenSet,
} from "../lib/auth/native-auth";
import { createOidcClient } from "../lib/auth/oidc-client";

import { useAppConfig } from "./use-app-config";

export type Role = "BUYER" | "SELLER" | "ADMIN";
export type { RegisterInput };

export interface AuthProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string;
}

interface AuthState {
  ready: boolean;
  authenticated: boolean;
  token: string | undefined;
  profile: AuthProfile | undefined;
  roles: Role[];
  subject: string | undefined;
  login: (redirectTo?: string) => void;
  beginOAuthLogin: (provider: "google" | "facebook", next?: string) => void;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

function parseRoles(claims: JwtClaims | null): Role[] {
  const realm = claims?.realm_access?.roles ?? [];
  return realm.filter(
    (role): role is Role => role === "BUYER" || role === "SELLER" || role === "ADMIN",
  );
}

function profileFromClaims(claims: JwtClaims | null): AuthProfile | undefined {
  if (!claims?.sub) return undefined;
  return {
    id: claims.sub,
    email: claims.email ?? "",
    firstName: claims.given_name,
    lastName: claims.family_name,
    username: claims.preferred_username,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const appConfig = useAppConfig();
  const oidc = useMemo(
    () =>
      createOidcClient({
        issuerUri: appConfig.auth.issuerUri,
        callbackUri: appConfig.auth.callbackUri,
        logoutUri: appConfig.auth.logoutUri,
        clientId: appConfig.auth.clientId,
      }),
    [
      appConfig.auth.callbackUri,
      appConfig.auth.clientId,
      appConfig.auth.issuerUri,
      appConfig.auth.logoutUri,
    ],
  );
  const [ready, setReady] = useState(false);
  const [tokenSet, setTokenSet] = useState<TokenSet | null>(null);
  const refreshTimeoutRef = useRef<number | null>(null);

  const applyTokenSet = useCallback((next: TokenSet | null) => {
    setTokenSet(next);
    setLiveTokenSet(next);
  }, []);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimeoutRef.current !== null) {
      window.clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
  }, []);

  const refreshSession = useCallback(async () => {
    const next = await oidc.refresh();
    applyTokenSet(next);
    return next;
  }, [applyTokenSet, oidc]);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setTokenRefreshHandler(refreshSession);
    void (async () => {
      try {
        const initial = await oidc.init();
        if (!cancelled) applyTokenSet(initial);
      } catch {
        if (!cancelled) applyTokenSet(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
      setTokenRefreshHandler(null);
    };
  }, [applyTokenSet, oidc, refreshSession]);

  useEffect(() => {
    clearRefreshTimer();
    if (!tokenSet) return;
    const refreshSkewMs = 30_000;
    const delay = Math.max(1_000, tokenSet.accessExpiresAt - Date.now() - refreshSkewMs);
    refreshTimeoutRef.current = window.setTimeout(() => {
      void refreshSession().catch(() => applyTokenSet(null));
    }, delay);
    return clearRefreshTimer;
  }, [applyTokenSet, clearRefreshTimer, refreshSession, tokenSet]);

  useEffect(() => {
    const clearSession = () => applyTokenSet(null);
    window.addEventListener("auth:unauthorized", clearSession);
    return () => window.removeEventListener("auth:unauthorized", clearSession);
  }, [applyTokenSet]);

  useEffect(() => {
    const refreshVisibleSession = () => {
      if (document.hidden || !tokenSet) return;
      void refreshSession().catch(() => applyTokenSet(null));
    };
    document.addEventListener("visibilitychange", refreshVisibleSession);
    window.addEventListener("focus", refreshVisibleSession);
    return () => {
      document.removeEventListener("visibilitychange", refreshVisibleSession);
      window.removeEventListener("focus", refreshVisibleSession);
    };
  }, [applyTokenSet, refreshSession, tokenSet]);

  const login = useCallback(
    (redirectTo?: string) => {
      const next = redirectTo ?? window.location.pathname + window.location.search;
      oidc.login(next);
    },
    [oidc],
  );

  const beginOAuthLogin = useCallback(
    (provider: "google" | "facebook", next?: string) => {
      oidc.login(next, provider);
    },
    [oidc],
  );

  const register = useCallback(async (input: RegisterInput) => {
    try {
      await registerUser(input);
    } catch (error) {
      if (error instanceof ApiError) {
        throw new AuthError(error.status, error.errorCode ?? "register_failed", error.message);
      }
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    applyTokenSet(null);
    oidc.logout();
  }, [applyTokenSet, oidc]);

  const value = useMemo<AuthState>(() => {
    const claims = tokenSet ? decodeJwt(tokenSet.accessToken) : null;
    return {
      ready,
      authenticated: tokenSet !== null,
      token: tokenSet?.accessToken,
      profile: profileFromClaims(claims),
      roles: parseRoles(claims),
      subject: claims?.sub,
      login,
      beginOAuthLogin,
      register,
      logout,
    };
  }, [beginOAuthLogin, login, logout, ready, register, tokenSet]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

export function useHasRole(role: Role): boolean {
  return useAuth().roles.includes(role);
}
