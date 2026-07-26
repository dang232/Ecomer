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
  ACCESS_TOKEN_REFRESH_BUFFER_MS,
  decodeJwt,
  isAccessTokenRefreshDue,
  passwordLogin,
  refreshTokens,
  revokeTokens,
  setLiveTokenSet,
  type JwtClaims,
  type TokenSet,
} from "../lib/auth/native-auth";
import { apiUrl } from "../lib/runtime-endpoints";

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
  loginWithPassword: (username: string, password: string) => Promise<void>;
  beginOAuthLogin: (provider: "google" | "facebook", next?: string) => void;
  register: (input: RegisterInput) => Promise<void>;
  logout: (redirectTo?: string) => void;
}

const AuthContext = createContext<AuthState | null>(null);

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
  const [ready, setReady] = useState(false);
  const [tokenSet, setTokenSet] = useState<TokenSet | null>(null);
  const refreshTimeoutRef = useRef<number | null>(null);
  const logoutInProgressRef = useRef(false);

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
    const next = await refreshTokens();
    // A refresh may have started immediately before logout. Do not let that
    // late response re-install a session while the logout redirect is pending.
    if (!logoutInProgressRef.current) applyTokenSet(next);
    return next;
  }, [applyTokenSet]);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    void (async () => {
      try {
        await refreshSession();
      } catch {
        if (!cancelled) applyTokenSet(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyTokenSet, refreshSession]);

  useEffect(() => {
    clearRefreshTimer();
    if (!tokenSet) return;
    const delay = Math.max(
      1_000,
      tokenSet.accessExpiresAt - Date.now() - ACCESS_TOKEN_REFRESH_BUFFER_MS,
    );
    refreshTimeoutRef.current = window.setTimeout(() => {
      void refreshSession().catch(() => {
        if (!logoutInProgressRef.current) applyTokenSet(null);
      });
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
      if (
        document.hidden ||
        !tokenSet ||
        !isAccessTokenRefreshDue(tokenSet) ||
        logoutInProgressRef.current
      ) {
        return;
      }
      void refreshSession().catch(() => {
        if (!logoutInProgressRef.current) applyTokenSet(null);
      });
    };
    document.addEventListener("visibilitychange", refreshVisibleSession);
    window.addEventListener("focus", refreshVisibleSession);
    return () => {
      document.removeEventListener("visibilitychange", refreshVisibleSession);
      window.removeEventListener("focus", refreshVisibleSession);
    };
  }, [applyTokenSet, refreshSession, tokenSet]);

  const login = useCallback((redirectTo?: string) => {
    const next = safeReturnPath(redirectTo ?? window.location.pathname + window.location.search);
    window.location.assign(`/login?next=${encodeURIComponent(next)}`);
  }, []);

  const loginWithPassword = useCallback(
    async (username: string, password: string) => {
      logoutInProgressRef.current = false;
      const next = await passwordLogin(username, password);
      applyTokenSet(next);
    },
    [applyTokenSet],
  );

  const beginOAuthLogin = useCallback((provider: "google" | "facebook", next?: string) => {
    const returnPath = safeReturnPath(next ?? window.location.pathname + window.location.search);
    const query = new URLSearchParams({ next: returnPath });
    window.location.assign(apiUrl(`/auth/oauth/${provider}/start?${query.toString()}`));
  }, []);

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

  const logout = useCallback(
    (redirectTo?: string) => {
      logoutInProgressRef.current = true;
      if (!redirectTo) {
        applyTokenSet(null);
        void revokeTokens();
        return;
      }

      // Keep the guarded route mounted until the cookie is revoked. Clearing
      // auth first lets RequireRole redirect to /login before the requested
      // storefront navigation can win.
      void revokeTokens().finally(() => {
        applyTokenSet(null);
        window.location.replace(safeReturnPath(redirectTo));
      });
    },
    [applyTokenSet],
  );

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
      loginWithPassword,
      beginOAuthLogin,
      register,
      logout,
    };
  }, [beginOAuthLogin, login, loginWithPassword, logout, ready, register, tokenSet]);

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
