import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

export interface AppConfig {
  brand: {
    name: string;
    tagline: string;
    logoUrl: string;
  };
  social: {
    facebook: string;
    instagram: string;
    twitter: string;
    youtube: string;
  };
  payment: {
    providers: string[];
    defaultMethod: string;
  };
  auth: {
    oauthProviders: string[];
  };
  features: {
    flashSale: boolean;
    messaging: boolean;
    notifications: boolean;
    reviews: boolean;
  };
  support: {
    phone: string;
    email: string;
    hours: string;
  };
  websocket: {
    notificationsPath: string;
    messagingPath: string;
    maxReconnectAttempts: number;
    reconnectBaseMs: number;
    reconnectCapMs: number;
  };
}

const DEFAULT_CONFIG: AppConfig = {
  brand: { name: "VNShop", tagline: "MARKETPLACE", logoUrl: "" },
  social: {
    facebook: "https://facebook.com",
    instagram: "https://instagram.com",
    twitter: "https://x.com",
    youtube: "https://youtube.com",
  },
  payment: {
    providers: ["VNPay", "MoMo", "COD", "Visa", "Mastercard"],
    defaultMethod: "COD",
  },
  auth: { oauthProviders: [] },
  features: {
    flashSale: true,
    messaging: true,
    notifications: true,
    reviews: true,
  },
  support: { phone: "1900-0000", email: "support@vnshop.vn", hours: "24/7" },
  websocket: {
    notificationsPath: "/ws/notifications",
    messagingPath: "/ws/messaging",
    maxReconnectAttempts: 5,
    reconnectBaseMs: 2000,
    reconnectCapMs: 30000,
  },
};

const appConfigSchema = z.object({
  brand: z.object({ name: z.string(), tagline: z.string(), logoUrl: z.string() }),
  social: z.object({
    facebook: z.string(),
    instagram: z.string(),
    twitter: z.string(),
    youtube: z.string(),
  }),
  payment: z.object({ providers: z.array(z.string()), defaultMethod: z.string() }),
  auth: z.object({ oauthProviders: z.array(z.string()) }).default({ oauthProviders: [] }),
  features: z.object({
    flashSale: z.boolean(),
    messaging: z.boolean(),
    notifications: z.boolean(),
    reviews: z.boolean(),
  }),
  support: z.object({ phone: z.string(), email: z.string(), hours: z.string() }),
  websocket: z.object({
    notificationsPath: z.string(),
    messagingPath: z.string(),
    maxReconnectAttempts: z.number().int().nonnegative(),
    reconnectBaseMs: z.number().int().positive(),
    reconnectCapMs: z.number().int().positive(),
  }),
});

const CONFIG_URL = (
  (import.meta.env as Record<string, string | undefined>).VITE_CONFIG_URL ??
  (import.meta.env as Record<string, string | undefined>).VITE_API_URL ??
  "http://localhost:8080"
).replace(/\/$/, "");

export async function fetchConfig(): Promise<AppConfig> {
  try {
    const res = await fetch(`${CONFIG_URL}/api/config`);
    if (!res.ok) throw new Error(`Config fetch failed: ${res.status}`);
    return appConfigSchema.parse(await res.json());
  } catch {
    // Fallback to defaults if config service is unavailable
    return DEFAULT_CONFIG;
  }
}

export function useAppConfig() {
  const query = useQuery<AppConfig>({
    queryKey: ["app-config"],
    queryFn: fetchConfig,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 1,
    placeholderData: DEFAULT_CONFIG,
  });

  return query.data ?? DEFAULT_CONFIG;
}
