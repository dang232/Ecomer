/* eslint-disable react-refresh/only-export-components --
 * AuthProvider colocates with its hooks intentionally — splitting them across
 * files would require updating every import site for marginal HMR benefit.
 */
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
  passwordLogin,
  refreshTokens,
  revokeTokens,
  setLiveTokenSet,
  type JwtClaims,
  type TokenSet,
} from "../lib/auth/native-auth";

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
  /**
   * Back-compat shim. Existing call sites navigated away to Keycloak via
   * `login(redirectTo)`. Now we redirect to the in-app /login page with the
   * desired `next=` so the native form takes over.
   */
  login: (redirectTo?: string) => void;
  loginWithCredentials: (username: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const REGISTER_ENDPOINT = `${(import.meta.env as Record<string, string | undefined>).VITE_API_URL ?? "http://localhost:8080"}/auth/register`;
// ponytail: REGISTER_ENDPOINT retained for back-compat with any third-party
// debug tooling that may read it via the module surface. The live flow uses
// registerUser() from lib/api/endpoints/auth so it goes through the full
// interceptor chain. Remove once we confirm no external readers.
void REGISTER_ENDPOINT;

function parseRoles(claims: JwtClaims | null): Role[] {
  const realm = claims?.realm_access?.roles ?? [];
  return realm.filter((r): r is Role => r === "BUYER" || r === "SELLER" || r === "ADMIN");
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

  const applyTokenSet = useCallback((next: TokenSet | null) => {
    setTokenSet(next);
    setLiveTokenSet(next);
    // No localStorage write — refresh-token cookie is the persistence
    // boundary now. The access token deliberately does not survive a
    // hard reload; the rehydrate effect calls /auth/refresh to recover
    // the session via the httpOnly cookie.
  }, []);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimeoutRef.current !== null) {
      window.clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
  }, []);

  const scheduleRefresh = useCallback(
    (current: TokenSet) => {
      clearRefreshTimer();
      const skewMs = 30_000;
      const delay = Math.max(0, current.accessExpiresAt - Date.now() - skewMs);
      refreshTimeoutRef.current = window.setTimeout(() => {
        void (async () => {
          try {
            const next = await refreshTokens();
            applyTokenSet(next);
          } catch {
            applyTokenSet(null);
          }
        })();
      }, delay);
    },
    [applyTokenSet, clearRefreshTimer],
  );

  // Rehydrate on mount. With the cookie-based flow we always ask
  // /auth/refresh: if a valid vnshop_rt cookie exists, Keycloak rotates
  // it and returns a fresh access token; otherwise we get 401 and stay
  // unauthenticated. There is no localStorage to read anymore.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const refreshed = await refreshTokens();
        if (!cancelled) applyTokenSet(refreshed);
      } catch {
        if (!cancelled) applyTokenSet(null);
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [applyTokenSet]);

  useEffect(() => {
    if (!tokenSet) {
      clearRefreshTimer();
      return;
    }
    scheduleRefresh(tokenSet);
    return clearRefreshTimer;
  }, [tokenSet, scheduleRefresh, clearRefreshTimer]);

  // Listen for the unrecoverable 401 signal dispatched by the api interceptor.
  useEffect(() => {
    const handler = () => applyTokenSet(null);
    window.addEventListener("auth:unauthorized", handler);
    return () => window.removeEventListener("auth:unauthorized", handler);
  }, [applyTokenSet]);

  // Cross-tab / F5 recovery: when a tab regains visibility and we appear
  // logged out, retry the cookie-based refresh. The httpOnly refresh-token
  // cookie persists across tabs, so this recovers sessions silently.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden || tokenSet) return;
      void (async () => {
        try {
          const next = await refreshTokens();
          applyTokenSet(next);
        } catch {
          // Cookie expired or missing — stay logged out.
        }
      })();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, [tokenSet, applyTokenSet]);

  const loginWithCredentials = useCallback(
    async (username: string, password: string) => {
      const next = await passwordLogin(username, password);
      applyTokenSet(next);
    },
    [applyTokenSet],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      try {
        await registerUser(input);
      } catch (err) {
        if (err instanceof ApiError) {
          throw new AuthError(
            err.status,
            err.errorCode ?? "register_failed",
            err.message,
          );
        }
        throw err;
      }
      // Auto-login with the credentials we just submitted.
      await loginWithCredentials(input.email, input.password);
    },
    [loginWithCredentials],
  );

  const logout = useCallback(() => {
    // Fire revoke before clearing local state so the cookie is still
    // attached to the request. revokeTokens swallows transport errors.
    void revokeTokens();
    applyTokenSet(null);
  }, [applyTokenSet]);

  const login = useCallback((redirectTo?: string) => {
    const next = redirectTo ?? window.location.pathname + window.location.search;
    window.location.assign(`/login?next=${encodeURIComponent(next)}`);
  }, []);

  const value = useMemo<AuthState>(() => {
    const claims = tokenSet ? decodeJwt(tokenSet.accessToken) : null;
    return {
      ready,
      authenticated: !!tokenSet,
      token: tokenSet?.accessToken,
      profile: profileFromClaims(claims),
      roles: parseRoles(claims),
      subject: claims?.sub,
      login,
      loginWithCredentials,
      register,
      logout,
    };
  }, [ready, tokenSet, login, loginWithCredentials, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useHasRole(role: Role): boolean {
  const { roles } = useAuth();
  return roles.includes(role);
}
