/**
 * Native auth client backed by the user-service /auth proxy.
 *
 * <p>Refresh token lives in an httpOnly cookie ({@code vnshop_rt},
 * {@code Path=/auth}, {@code SameSite=Lax}) issued by user-service on login.
 * The access token never touches localStorage — it sits in module memory
 * only ({@link liveTokenSet}). On page reload, the FE calls
 * {@link refreshTokens} which sends the cookie and gets a fresh access
 * token; if no cookie exists or it's expired, the user is unauthenticated
 * and bounces to /login.
 *
 * <p>This trades the "tokens survive a hard refresh in JS-readable storage"
 * shape for "refresh-token theft via XSS is impossible." Access-token theft
 * via XSS still works in principle, but the window is short (15min) and
 * the access token alone can't bootstrap a new session.
 *
 * <h2>CSRF double-submit</h2>
 * user-service's {@code CsrfProtectionFilter} requires the SPA to echo the
 * {@code vnshop_csrf} cookie value back in the {@code X-CSRF-Token} header
 * on {@code POST /auth/refresh} and {@code POST /auth/logout} (login is
 * excluded because it is not cookie-authenticated). The cookie is issued as
 * <strong>non-httpOnly</strong> on purpose: the SPA must be able to read it
 * via {@code document.cookie} and add it as a header. The browser still sends
 * the cookie automatically on the request, so the server compares the two
 * values and rejects mismatches — a cross-origin attacker cannot read the
 * cookie (same-origin policy) and therefore cannot forge the header.
 */

import { z } from "zod";

import { readJsonText } from "@/shared/api";
import { apiUrl } from "@/shared/config";

/** Name of the non-httpOnly CSRF cookie set by user-service. */
export const CSRF_COOKIE_NAME = "vnshop_csrf";
/** Header that must echo the CSRF cookie value on /auth/refresh and /auth/logout. */
export const CSRF_HEADER_NAME = "X-CSRF-Token";

export interface TokenSet {
  accessToken: string;
  /** Epoch milliseconds. */
  accessExpiresAt: number;
}

/** Refresh shortly before access-token expiry, not on every browser focus. */
export const ACCESS_TOKEN_REFRESH_BUFFER_MS = 60_000;

export function isAccessTokenRefreshDue(
  tokenSet: Pick<TokenSet, "accessExpiresAt">,
  now = Date.now(),
  bufferMs = ACCESS_TOKEN_REFRESH_BUFFER_MS,
): boolean {
  return tokenSet.accessExpiresAt - now <= bufferMs;
}

const authSessionSchema = z.object({
  accessToken: z.string().trim().min(1),
  accessExpiresIn: z.number().positive(),
});

const authEnvelopeSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    data: authSessionSchema.optional(),
    errorCode: z.string().optional(),
  })
  .passthrough()
  .nullable();

const jwtClaimsSchema = z
  .object({
    sub: z.string(),
    email: z.string().optional(),
    given_name: z.string().optional(),
    family_name: z.string().optional(),
    preferred_username: z.string().optional(),
    realm_access: z.object({ roles: z.array(z.string()).optional() }).optional(),
    exp: z.number().optional(),
  })
  .passthrough();

export type JwtClaims = z.infer<typeof jwtClaimsSchema>;

export class AuthError extends Error {
  readonly statusCode: number;
  readonly errorCode: string;
  constructor(statusCode: number, errorCode: string, message: string) {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

/** Module-level live reference. Kept in sync by the AuthProvider so the api client can read the current token without going through React. */
let liveTokenSet: TokenSet | null = null;
let inFlightRefresh: Promise<TokenSet> | null = null;

export function getAccessToken(): string | null {
  return liveTokenSet?.accessToken ?? null;
}

export function setLiveTokenSet(next: TokenSet | null): void {
  liveTokenSet = next;
}

type AuthSessionResponse = z.infer<typeof authSessionSchema>;

function tokenSetFrom(payload: AuthSessionResponse): TokenSet {
  // Guard: reject empty access tokens to prevent silent auth failures
  if (
    !payload.accessToken ||
    typeof payload.accessToken !== "string" ||
    !payload.accessToken.trim()
  ) {
    throw new AuthError(401, "empty_token", "Login failed: no valid token received");
  }
  return {
    accessToken: payload.accessToken,
    accessExpiresAt: Date.now() + payload.accessExpiresIn * 1000,
  };
}

/**
 * Reads the value of a single cookie from {@code document.cookie}.
 *
 * <p>Used to retrieve the {@code vnshop_csrf} token the SPA must echo in the
 * {@code X-CSRF-Token} header. Exported for testability — production callers
 * should use {@link csrfAuthHeader} instead.
 */
export function readCookieValue(cookieName: string): string {
  if (typeof document === "undefined") return "";
  const cookieString = document.cookie ?? "";
  if (!cookieString) return "";
  const escaped = cookieName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp("(?:^|;\\s*)" + escaped + "=([^;]*)").exec(cookieString);
  return match ? decodeURIComponent(match[1]) : "";
}

/**
 * Returns the {@code X-CSRF-Token} header value the SPA should send on
 * state-changing auth requests, or {@code undefined} if the cookie is not
 * present. Exported for testability.
 */
export function csrfAuthHeader(): Record<string, string> | undefined {
  const token = readCookieValue(CSRF_COOKIE_NAME);
  return token ? { [CSRF_HEADER_NAME]: token } : undefined;
}

async function postAuth(
  url: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (body != null) headers["Content-Type"] = "application/json";
  if (extraHeaders) Object.assign(headers, extraHeaders);
  return fetch(url, {
    method: "POST",
    headers,
    // CRITICAL: send + receive the vnshop_rt cookie. Without this, the
    // browser strips the cookie on cross-origin requests and refresh
    // returns 401 forever.
    credentials: "include",
    body: body != null ? JSON.stringify(body) : undefined,
  });
}

async function readEnvelope(res: Response, fallbackErrorCode: string): Promise<TokenSet> {
  const text = await res.text().catch(() => "");
  let envelope: z.infer<typeof authEnvelopeSchema> = null;
  try {
    envelope = text ? readJsonText(text, authEnvelopeSchema) : null;
  } catch {
    /* keep envelope null and fall through */
  }
  if (!res.ok || !envelope?.data) {
    const code = envelope?.errorCode ?? fallbackErrorCode;
    const message = envelope?.message ?? `Auth failed (HTTP ${res.status})`;
    // Treat invalid-credentials and missing-cookie as 401 to the caller
    // regardless of the underlying transport status, so call sites have a
    // single check to make.
    const status = code === "invalid_credentials" || code === "no_session" ? 401 : res.status;
    throw new AuthError(status, code, message);
  }
  return tokenSetFrom(envelope.data);
}

export async function passwordLogin(username: string, password: string): Promise<TokenSet> {
  // /auth/login is excluded from the CSRF filter (it is not cookie-authenticated),
  // so do not attach the X-CSRF-Token header here.
  const res = await postAuth(apiUrl("/auth/login"), { username, password });
  return readEnvelope(res, "auth_failed");
}

export async function refreshTokens(): Promise<TokenSet> {
  if (inFlightRefresh) return inFlightRefresh;
  const csrfHeaders = csrfAuthHeader();
  if (!csrfHeaders) {
    return Promise.reject(
      new AuthError(403, "csrf_missing", "Refresh session is unavailable without a CSRF cookie"),
    );
  }
  const pending = (async () => {
    const res = await postAuth(apiUrl("/auth/refresh"), undefined, csrfHeaders);
    return readEnvelope(res, "refresh_failed");
  })();
  inFlightRefresh = pending;
  // Clear the cache after consumers have had a chance to read it, so a
  // second concurrent call (e.g. React StrictMode double-invoke) doesn't
  // block on a stale null reference. The resolved value stays with callers.
  void pending.finally(() => {
    if (inFlightRefresh === pending) inFlightRefresh = null;
  });
  return pending;
}

export async function revokeTokens(): Promise<void> {
  try {
    const csrfHeaders = csrfAuthHeader();
    if (!csrfHeaders) return;
    await postAuth(apiUrl("/auth/logout"), undefined, csrfHeaders);
  } catch {
    // Best-effort. Local state is cleared regardless.
  }
}

export function decodeJwt(token: string): JwtClaims | null {
  try {
    const segment = token.split(".")[1];
    if (!segment) return null;
    const padded = segment + "=".repeat((4 - (segment.length % 4)) % 4);
    const json = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    return readJsonText(decodeURIComponent(escape(json)), jwtClaimsSchema);
  } catch {
    return null;
  }
}
