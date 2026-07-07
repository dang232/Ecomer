import type { z } from "zod";

import { ApiError } from "./envelope";
import {
  authInterceptor,
  contentTypeInterceptor,
  correlationIdInterceptor,
  envelopeInterceptor,
  errorStatusInterceptor,
  idempotencyInterceptor,
  jsonParseInterceptor,
  retryInterceptor,
  telemetryInterceptor,
  unauthorizedInterceptor,
  UnauthorizedError,
  type ErrorInterceptor,
  type RequestContext,
  type RequestInterceptor,
  type ResponseContext,
  type ResponseInterceptor,
} from "./interceptors";

const BASE_URL = (
  (import.meta.env as Record<string, string | undefined>).VITE_API_URL ?? "http://localhost:8080"
).replace(/\/$/, "");

// ---------------------------------------------------------------------------
// Cross-tab token-refresh coordination via BroadcastChannel
// ---------------------------------------------------------------------------
const REFRESH_CHANNEL =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("vnshop:token-refresh")
    : null;

type RefreshMessage =
  | { type: "refresh-started" }
  | { type: "refresh-complete"; success: boolean };

/** Resolves to true when another tab's refresh succeeds, false on failure. */
let crossTabRefreshPromise: Promise<boolean> | null = null;
let crossTabRefreshResolve: ((success: boolean) => void) | null = null;
/** True while this tab owns the in-flight refresh. */
let thisTabRefreshing = false;
/** Epoch-ms timestamp when this tab claimed the refresh lock. Used to detect stale locks. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars,@typescript-eslint/no-explicit-any
let _refreshLockTimestamp: any = 0;
const REFRESH_LOCK_TIMEOUT_MS = 15_000;

if (REFRESH_CHANNEL) {
  REFRESH_CHANNEL.onmessage = (ev: MessageEvent<RefreshMessage>) => {
    const msg = ev.data;
    if (msg.type === "refresh-started" && !thisTabRefreshing) {
      // Another tab started a refresh — park behind its result.
      if (!crossTabRefreshPromise) {
        crossTabRefreshPromise = new Promise<boolean>((resolve) => {
          crossTabRefreshResolve = resolve;
        });
        // Safety timeout: if the owning tab crashes or hangs and never sends
        // "refresh-complete", release parked tabs after REFRESH_LOCK_TIMEOUT_MS
        // so they can attempt their own refresh instead of blocking forever.
        setTimeout(() => {
          if (crossTabRefreshPromise) {
            crossTabRefreshResolve?.(false);
            crossTabRefreshResolve = null;
            crossTabRefreshPromise = null;
          }
        }, REFRESH_LOCK_TIMEOUT_MS);
      }
    } else if (msg.type === "refresh-complete") {
      crossTabRefreshResolve?.(msg.success);
      crossTabRefreshResolve = null;
      crossTabRefreshPromise = null;
    }
  };
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions<TSchema extends z.ZodType> {
  method?: Method;
  path: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  schema: TSchema;
  signal?: AbortSignal;
  /** Send Authorization even when anonymous endpoints would work — defaults to true. */
  auth?: boolean;
  /** Adds Idempotency-Key header (used by POST /orders). */
  idempotencyKey?: string;
  /**
   * Cookie credentials mode. Defaults to "omit". Use "include" for auth
   * bootstrap endpoints (login, register, password-reset) that need the
   * browser to attach / receive httpOnly cookies on cross-origin responses.
   */
  credentials?: RequestCredentials;
}

function buildUrl(path: string, query?: RequestOptions<z.ZodType>["query"]): string {
  const url = new URL(path.startsWith("/") ? `${BASE_URL}${path}` : `${BASE_URL}/${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

/**
 * Default request interceptor chain. Order matters: correlation id first so it
 * appears on every request, content-type/idempotency before auth so an auth
 * refresh failure doesn't strip headers we already set.
 */
const REQUEST_CHAIN: readonly RequestInterceptor[] = [
  correlationIdInterceptor,
  contentTypeInterceptor,
  idempotencyInterceptor,
  authInterceptor,
];

/** Error interceptor chain. 401-refresh runs first; retry picks up after. */
const ERROR_CHAIN: readonly ErrorInterceptor[] = [unauthorizedInterceptor, retryInterceptor];

async function runRequestChain(ctx: RequestContext): Promise<RequestContext> {
  let current = ctx;
  for (const interceptor of REQUEST_CHAIN) {
    current = await interceptor(current);
  }
  return current;
}

async function runResponseChain(
  ctx: ResponseContext,
  responseChain: readonly ResponseInterceptor[],
): Promise<ResponseContext> {
  let current = ctx;
  for (const interceptor of responseChain) {
    current = await interceptor(current);
  }
  return current;
}

/**
 * Walks the error interceptor chain. The first interceptor that returns a
 * `Response` short-circuits and that response becomes the new pipeline result.
 * If every interceptor returns `void`, the original error is re-thrown.
 */
async function runErrorChain(err: unknown, ctx: RequestContext): Promise<Response> {
  for (const interceptor of ERROR_CHAIN) {
    const result = await interceptor(err, ctx);
    if (result instanceof Response) return result;
  }
  throw err;
}

const DEFAULT_TIMEOUT_MS = 30_000;

export async function request<TSchema extends z.ZodType>(
  opts: RequestOptions<TSchema>,
): Promise<z.infer<TSchema>> {
  const method: Method = opts.method ?? "GET";
  const auth = opts.auth ?? true;
  const correlationId = crypto.randomUUID();
  const url = buildUrl(opts.path, opts.query);
  const hasBody = opts.body !== undefined && method !== "GET";

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(
    () => timeoutController.abort(new Error("Request timed out")),
    DEFAULT_TIMEOUT_MS,
  );

  const composedSignal = opts.signal
    ? AbortSignal.any([opts.signal, timeoutController.signal])
    : timeoutController.signal;

  const init: RequestInit = {
    method,
    headers: {},
    body: hasBody ? JSON.stringify(opts.body) : undefined,
    signal: composedSignal,
    credentials: opts.credentials ?? "omit",
  };

  try {
  const requestCtx = await runRequestChain({
    url,
    init,
    correlationId,
    meta: {
      auth,
      idempotencyKey: opts.idempotencyKey,
      hasBody,
      attempts: 1,
      startedAt: Date.now(),
      method,
      path: opts.path,
    },
  });

  let response = await fetch(requestCtx.url, requestCtx.init);

  // 401 path: surface a sentinel through the error chain so interceptors can
  // attempt token refresh + retry. If still 401 after, the unauthorized
  // interceptor has already cleared local auth state and dispatched
  // `auth:unauthorized` — surfacing a thrown ApiError lets callers render
  // their own error UI while AuthProvider redirects.
  //
  // Cross-tab coordination: if another tab is already refreshing, park behind
  // its BroadcastChannel result instead of issuing a duplicate refresh.
  if (response.status === 401 && auth) {
    if (crossTabRefreshPromise && !thisTabRefreshing) {
      // Another tab owns the refresh — wait for its outcome.
      const succeeded = await crossTabRefreshPromise;
      if (!succeeded) {
        window.dispatchEvent(new Event("auth:unauthorized"));
        throw new ApiError(401, "UNAUTHORIZED", "Authentication required", correlationId);
      }
      // Retry the original request with the new token. Preserve telemetry meta.
      const retryCtx = await runRequestChain({
        url,
        init: { ...init, headers: {} },
        correlationId,
        meta: {
          ...requestCtx.meta,
          auth,
          idempotencyKey: opts.idempotencyKey,
          hasBody,
        },
      });
      response = await fetch(retryCtx.url, retryCtx.init);
    } else if (!thisTabRefreshing) {
      // This tab owns the refresh. Guard with !thisTabRefreshing so a second
      // 401 arriving while we already hold the lock doesn't start a duplicate.
      thisTabRefreshing = true;
      _refreshLockTimestamp = Date.now();
      REFRESH_CHANNEL?.postMessage({ type: "refresh-started" } satisfies RefreshMessage);
      let refreshSucceeded = false;
      try {
        response = await runErrorChain(new UnauthorizedError(response), requestCtx);
        refreshSucceeded = response.status !== 401;
      } catch {
        refreshSucceeded = false;
      } finally {
        thisTabRefreshing = false;
        REFRESH_CHANNEL?.postMessage({
          type: "refresh-complete",
          success: refreshSucceeded,
        } satisfies RefreshMessage);
      }
      if (!refreshSucceeded) {
        window.dispatchEvent(new Event("auth:unauthorized"));
        throw new ApiError(401, "UNAUTHORIZED", "Authentication required", correlationId);
      }
      // refreshSucceeded === true means runErrorChain returned a Response
      // whose status was not 401. But unauthorizedInterceptor's refresh path
      // could have been triggered by an EARLIER 401 mid-retry — if so, we
      // may have already done a refresh + replay earlier and the replay's
      // response is still in `response`. Belt-and-suspenders check: if the
      // post-refresh response is STILL 401, surface it as an unrecoverable
      // auth failure so the caller sees a clean 401 rather than a 503 (which
      // would happen if retryInterceptor skipped this 401 mid-retry).
      if (response.status === 401) {
        window.dispatchEvent(new Event("auth:unauthorized"));
        throw new ApiError(401, "UNAUTHORIZED", "Authentication required", correlationId);
      }
    } else {
      // thisTabRefreshing is already true — a concurrent request hit 401 while
      // this tab's refresh is in-flight. The token will be updated once the
      // in-flight refresh resolves; treat this as an auth failure since the
      // original token was already invalid.
      window.dispatchEvent(new Event("auth:unauthorized"));
      throw new ApiError(401, "UNAUTHORIZED", "Authentication required", correlationId);
    }
  }

  const responseChain: readonly ResponseInterceptor[] = [
    jsonParseInterceptor,
    telemetryInterceptor,
    errorStatusInterceptor,
    envelopeInterceptor(opts.schema),
  ];

  const finalCtx = await runResponseChain(
    { request: requestCtx, response, parsed: null },
    responseChain,
  );
  return finalCtx.parsed as z.infer<TSchema>;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const api = {
  get: <T extends z.ZodType>(
    path: string,
    schema: T,
    query?: RequestOptions<T>["query"],
    opts?: Pick<RequestOptions<T>, "auth" | "signal" | "credentials">,
  ) => request({ method: "GET", path, schema, query, ...opts }),
  post: <T extends z.ZodType>(
    path: string,
    schema: T,
    body?: unknown,
    opts?: Pick<RequestOptions<T>, "auth" | "signal" | "idempotencyKey" | "credentials">,
  ) => request({ method: "POST", path, schema, body, ...opts }),
  put: <T extends z.ZodType>(
    path: string,
    schema: T,
    body?: unknown,
    opts?: Pick<RequestOptions<T>, "auth" | "signal" | "credentials">,
  ) => request({ method: "PUT", path, schema, body, ...opts }),
  patch: <T extends z.ZodType>(
    path: string,
    schema: T,
    body?: unknown,
    opts?: Pick<RequestOptions<T>, "auth" | "signal" | "credentials">,
  ) => request({ method: "PATCH", path, schema, body, ...opts }),
  delete: <T extends z.ZodType>(
    path: string,
    schema: T,
    opts?: Pick<RequestOptions<T>, "auth" | "signal" | "credentials">,
  ) => request({ method: "DELETE", path, schema, ...opts }),
};
