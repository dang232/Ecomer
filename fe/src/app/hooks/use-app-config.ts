import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { configureApiOrigin } from "../lib/runtime-endpoints";

const providerIdSchema = z.enum(["cod", "vietqr", "stripe", "paypal", "vnpay", "momo", "sepay"]);

const providerSchema = z.object({
  id: providerIdSchema,
  status: z.enum(["enabled", "disabled"]),
  mode: z.enum(["stub", "demo", "sandbox", "disabled"]),
  reasonCode: z.string().min(1),
});

const appConfigSchema = z
  .object({
    schemaVersion: z.string().regex(/^1\.\d+$/, "unsupported runtime configuration major"),
    generatedAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    runtimeConfigUri: z.string().url(),
    webUri: z.string().url(),
    apiUri: z.string().url(),
    brand: z.object({ name: z.string(), tagline: z.string(), logoUrl: z.string() }),
    social: z.object({
      facebook: z.string().url(),
      instagram: z.string().url(),
      twitter: z.string().url(),
      youtube: z.string().url(),
    }),
    payment: z.object({ providers: z.array(z.string()), defaultMethod: z.string() }),
    auth: z.object({
      oauthProviders: z.array(z.string()),
      issuerUri: z.string().url(),
      callbackUri: z.string().url(),
      logoutUri: z.string().url(),
      clientId: z.string().min(1),
    }),
    features: z.object({
      checkout: z.boolean(),
      flashSale: z.boolean(),
      messaging: z.boolean(),
      notifications: z.boolean(),
      reviews: z.boolean(),
    }),
    support: z.object({ phone: z.string(), email: z.string(), hours: z.string() }),
    websocket: z.object({
      notificationsPath: z.literal("/ws/notifications"),
      messagingPath: z.literal("/ws/messaging"),
      notificationsUri: z.string().url(),
      messagingUri: z.string().url(),
      maxReconnectAttempts: z.number().int().nonnegative(),
      reconnectBaseMs: z.number().int().positive(),
      reconnectCapMs: z.number().int().positive(),
    }),
    providers: z.array(providerSchema).length(7),
  })
  .superRefine((config, context) => {
    const web = secureUrl(config.webUri, "https:", "/");
    const api = secureUrl(config.apiUri, "https:", "/");
    const issuer = secureUrl(config.auth.issuerUri, "https:", "/realms/vnshop");
    const callback = secureUrl(config.auth.callbackUri, "https:", "/auth/callback");
    const logout = secureUrl(config.auth.logoutUri, "https:", "/");
    const notifications = secureUrl(config.websocket.notificationsUri, "wss:", "/ws/notifications");
    const messaging = secureUrl(config.websocket.messagingUri, "wss:", "/ws/messaging");
    const runtimeConfig = secureUrl(config.runtimeConfigUri, "https:", "/runtime-config.json");

    const invalid = (path: (string | number)[], message: string) =>
      context.addIssue({ code: "custom", path, message });

    if (!web) invalid(["webUri"], "webUri must be a canonical HTTPS origin on port 443");
    if (!api) invalid(["apiUri"], "apiUri must be a canonical HTTPS origin on port 443");
    if (!issuer) invalid(["auth", "issuerUri"], "issuerUri must use the vnshop realm");
    if (!callback) invalid(["auth", "callbackUri"], "callbackUri must use /auth/callback");
    if (!logout) invalid(["auth", "logoutUri"], "logoutUri must use the web origin root");
    if (!notifications)
      invalid(["websocket", "notificationsUri"], "notificationsUri must be secure and exact");
    if (!messaging) invalid(["websocket", "messagingUri"], "messagingUri must be secure and exact");
    if (!runtimeConfig) invalid(["runtimeConfigUri"], "runtimeConfigUri must be secure and exact");

    if (web && runtimeConfig && runtimeConfig.origin !== web.origin) {
      invalid(["runtimeConfigUri"], "runtimeConfigUri must use the web origin");
    }
    if (web && callback && callback.origin !== web.origin) {
      invalid(["auth", "callbackUri"], "callbackUri must use the web origin");
    }
    if (web && logout && logout.origin !== web.origin) {
      invalid(["auth", "logoutUri"], "logoutUri must use the web origin");
    }
    if (api && notifications && notifications.host !== api.host) {
      invalid(["websocket", "notificationsUri"], "notificationsUri must use the API host");
    }
    if (api && messaging && messaging.host !== api.host) {
      invalid(["websocket", "messagingUri"], "messagingUri must use the API host");
    }

    const generatedAt = Date.parse(config.generatedAt);
    const expiresAt = Date.parse(config.expiresAt);
    if (expiresAt <= generatedAt || expiresAt - generatedAt > 5 * 60 * 1000) {
      invalid(["expiresAt"], "runtime configuration lifetime must be at most five minutes");
    }
    if (expiresAt <= Date.now()) {
      invalid(["expiresAt"], "runtime configuration has expired");
    }

    const providerIds = new Set(config.providers.map((provider) => provider.id));
    if (providerIds.size !== providerIdSchema.options.length) {
      invalid(["providers"], "providers must contain each supported provider exactly once");
    }
  });

export type AppConfig = z.infer<typeof appConfigSchema>;
export type ProviderConfig = z.infer<typeof providerSchema>;

function secureUrl(value: string, protocol: "https:" | "wss:", path: string): URL | null {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const ipAddress = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.includes(":");
    const localHttp =
      allowInsecureLocalRuntimeConfig && hostname === "localhost" && url.protocol === "http:";
    const localWs =
      allowInsecureLocalRuntimeConfig && hostname === "localhost" && url.protocol === "ws:";
    const validProtocol =
      url.protocol === protocol || (protocol === "https:" ? localHttp : localWs);
    const validPort =
      url.protocol === protocol
        ? url.port === "" || url.port === "443"
        : (localHttp || localWs) && url.port !== "";
    if (
      !validProtocol ||
      !validPort ||
      url.pathname !== path ||
      url.username !== "" ||
      url.password !== "" ||
      url.search !== "" ||
      url.hash !== "" ||
      hostname.includes("*") ||
      (!localHttp && !localWs && hostname === "localhost") ||
      hostname.endsWith(".localhost") ||
      (!allowInsecureLocalRuntimeConfig && ipAddress)
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

const disabledProviders: ProviderConfig[] = providerIdSchema.options.map((id) => ({
  id,
  status: "disabled",
  mode: "disabled",
  reasonCode: "CONFIG_UNAVAILABLE",
}));

export const MAINTENANCE_CONFIG: AppConfig = {
  schemaVersion: "1.0",
  generatedAt: "1970-01-01T00:00:00.000Z",
  expiresAt: "1970-01-01T00:05:00.000Z",
  runtimeConfigUri: "https://web.vnshop.invalid/runtime-config.json",
  webUri: "https://web.vnshop.invalid/",
  apiUri: "https://api.vnshop.invalid/",
  brand: { name: "VNShop", tagline: "MARKETPLACE", logoUrl: "" },
  social: {
    facebook: "https://facebook.com",
    instagram: "https://instagram.com",
    twitter: "https://x.com",
    youtube: "https://youtube.com",
  },
  payment: { providers: [], defaultMethod: "" },
  auth: {
    oauthProviders: [],
    issuerUri: "https://auth.vnshop.invalid/realms/vnshop",
    callbackUri: "https://web.vnshop.invalid/auth/callback",
    logoutUri: "https://web.vnshop.invalid/",
    clientId: "vnshop-web",
  },
  features: {
    checkout: false,
    flashSale: false,
    messaging: false,
    notifications: false,
    reviews: false,
  },
  support: { phone: "", email: "", hours: "" },
  websocket: {
    notificationsPath: "/ws/notifications",
    messagingPath: "/ws/messaging",
    notificationsUri: "wss://api.vnshop.invalid/ws/notifications",
    messagingUri: "wss://api.vnshop.invalid/ws/messaging",
    maxReconnectAttempts: 0,
    reconnectBaseMs: 1000,
    reconnectCapMs: 1000,
  },
  providers: disabledProviders,
};

const env = import.meta.env as Record<string, string | undefined>;
const allowInsecureLocalRuntimeConfig = env.VITE_ALLOW_INSECURE_RUNTIME_CONFIG === "true";
const CONFIG_URL = env.VITE_RUNTIME_CONFIG_URL ?? "/runtime-config.json";

export async function fetchConfig(signal?: AbortSignal): Promise<AppConfig> {
  const timeout = AbortSignal.timeout(10_000);
  const response = await fetch(CONFIG_URL, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Config fetch failed: ${response.status}`);
  }
  const raw: unknown = await response.json();
  const config = appConfigSchema.parse(raw);
  configureApiOrigin(config.apiUri);
  return config;
}

export function useAppConfigQuery() {
  return useQuery<AppConfig>({
    queryKey: ["app-config", "1"],
    queryFn: ({ signal }) => fetchConfig(signal),
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 4 * 60 * 1000,
    refetchIntervalInBackground: true,
    retry: 1,
  });
}

export function useAppConfig(): AppConfig {
  const query = useAppConfigQuery();
  return query.isError ? MAINTENANCE_CONFIG : (query.data ?? MAINTENANCE_CONFIG);
}
