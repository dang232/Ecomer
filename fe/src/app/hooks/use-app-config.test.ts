import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getApiOrigin } from "@/shared/config";

import { fetchConfig, MAINTENANCE_CONFIG } from "./use-app-config";

const validConfig = {
  schemaVersion: "1.0",
  generatedAt: "2026-07-19T10:00:00.000Z",
  expiresAt: "2026-07-19T10:05:00.000Z",
  runtimeConfigUri: "https://shop.vnshop.invalid/runtime-config.json",
  webUri: "https://shop.vnshop.invalid/",
  apiUri: "https://api.vnshop.invalid/",
  brand: { name: "VNShop", tagline: "MARKETPLACE", logoUrl: "" },
  social: {
    facebook: "https://facebook.com",
    instagram: "https://instagram.com",
    twitter: "https://x.com",
    youtube: "https://youtube.com",
  },
  payment: { providers: ["COD", "VietQR"], defaultMethod: "COD" },
  auth: {
    oauthProviders: [],
    issuerUri: "https://api.vnshop.invalid/realms/vnshop",
    callbackUri: "https://shop.vnshop.invalid/auth/callback",
    logoutUri: "https://shop.vnshop.invalid/",
    clientId: "vnshop-web",
  },
  features: {
    checkout: true,
    flashSale: true,
    messaging: true,
    notifications: true,
    reviews: true,
  },
  support: { phone: "1900-0000", email: "support@vnshop.vn", hours: "24/7" },
  websocket: {
    notificationsPath: "/ws/notifications",
    messagingPath: "/ws/messaging",
    notificationsUri: "wss://api.vnshop.invalid/ws/notifications",
    messagingUri: "wss://api.vnshop.invalid/ws/messaging",
    maxReconnectAttempts: 5,
    reconnectBaseMs: 2000,
    reconnectCapMs: 30000,
  },
  providers: [
    { id: "cod", status: "enabled", mode: "stub", reasonCode: "PORTFOLIO_STUB" },
    { id: "vietqr", status: "enabled", mode: "demo", reasonCode: "PORTFOLIO_DEMO" },
    {
      id: "stripe",
      status: "disabled",
      mode: "sandbox",
      reasonCode: "DISABLED_BY_CONFIGURATION",
    },
    {
      id: "paypal",
      status: "disabled",
      mode: "sandbox",
      reasonCode: "DISABLED_BY_CONFIGURATION",
    },
    { id: "vnpay", status: "disabled", mode: "disabled", reasonCode: "DISABLED_BY_POLICY" },
    { id: "momo", status: "disabled", mode: "disabled", reasonCode: "DISABLED_BY_POLICY" },
    { id: "sepay", status: "disabled", mode: "disabled", reasonCode: "DISABLED_BY_POLICY" },
  ],
};

describe("fetchConfig", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-19T10:02:00.000Z"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("loads the same-origin runtime document", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(validConfig), { status: 200 }));

    await expect(fetchConfig()).resolves.toEqual(validConfig);
    expect(getApiOrigin()).toBe("https://api.vnshop.invalid");

    expect(fetchMock).toHaveBeenCalledWith(
      "/runtime-config.json",
      expect.objectContaining({
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      }),
    );
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("accepts same-origin development proxy endpoints", async () => {
    const developmentConfig = {
      ...validConfig,
      apiUri: "https://shop.vnshop.invalid/api/",
      websocket: {
        ...validConfig.websocket,
        notificationsUri: "wss://shop.vnshop.invalid/api/ws/notifications",
        messagingUri: "wss://shop.vnshop.invalid/api/ws/messaging",
      },
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(developmentConfig), { status: 200 }),
    );

    await expect(fetchConfig()).resolves.toEqual(developmentConfig);
    expect(getApiOrigin()).toBe("https://shop.vnshop.invalid/api");
  });

  it("rejects unknown major schema versions", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ...validConfig, schemaVersion: "2.0" }), { status: 200 }),
    );

    await expect(fetchConfig()).rejects.toThrow(/schemaVersion/);
  });

  it("accepts a backward-compatible minor version", async () => {
    const compatible = { ...validConfig, schemaVersion: "1.1" };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(compatible), { status: 200 }),
    );

    await expect(fetchConfig()).resolves.toEqual(compatible);
  });

  it("accepts the configuration-service provider set including SePay", async () => {
    const backendConfig = {
      ...validConfig,
      providers: [
        { id: "cod", status: "enabled", mode: "stub", reasonCode: "PORTFOLIO_STUB" },
        { id: "vietqr", status: "enabled", mode: "demo", reasonCode: "PORTFOLIO_DEMO" },
        {
          id: "stripe",
          status: "disabled",
          mode: "sandbox",
          reasonCode: "DISABLED_BY_CONFIGURATION",
        },
        {
          id: "paypal",
          status: "disabled",
          mode: "sandbox",
          reasonCode: "DISABLED_BY_CONFIGURATION",
        },
        { id: "vnpay", status: "disabled", mode: "disabled", reasonCode: "DISABLED_BY_POLICY" },
        { id: "momo", status: "disabled", mode: "disabled", reasonCode: "DISABLED_BY_POLICY" },
        { id: "sepay", status: "disabled", mode: "disabled", reasonCode: "DISABLED_BY_POLICY" },
      ],
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(backendConfig), { status: 200 }),
    );

    await expect(fetchConfig()).resolves.toEqual(backendConfig);
    expect(getApiOrigin()).toBe("https://api.vnshop.invalid");
  });

  it("rejects an otherwise valid expired runtime document", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ...validConfig,
          generatedAt: "2026-07-19T09:55:00.000Z",
          expiresAt: "2026-07-19T10:00:00.000Z",
        }),
        { status: 200 },
      ),
    );

    await expect(fetchConfig()).rejects.toThrow(/expired/);
  });

  it.each([
    ["apiUri", "http://api.vnshop.invalid/"],
    ["apiUri", "https://localhost/"],
    ["apiUri", "https://127.0.0.1/"],
    ["apiUri", "https://api.vnshop.invalid:8443/"],
    ["runtimeConfigUri", "https://other.vnshop.invalid/runtime-config.json"],
    ["auth.callbackUri", "https://shop.vnshop.invalid/callback"],
    ["websocket.messagingUri", "wss://other.vnshop.invalid/ws/messaging"],
  ])("fails closed for an invalid %s", async (field, value) => {
    const candidate = structuredClone(validConfig) as Record<string, unknown>;
    const path = field.split(".");
    let target = candidate;
    for (const segment of path.slice(0, -1)) {
      target = target[segment] as Record<string, unknown>;
    }
    target[path.at(-1)!] = value;
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(candidate), { status: 200 }),
    );

    await expect(fetchConfig()).rejects.toThrow();
  });

  it("does not replace a cold fetch failure with permissive defaults", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("network unavailable"));

    await expect(fetchConfig()).rejects.toThrow("network unavailable");
    expect(MAINTENANCE_CONFIG.payment.providers).toEqual([]);
    expect(MAINTENANCE_CONFIG.features.checkout).toBe(false);
    expect(MAINTENANCE_CONFIG.providers.every((provider) => provider.status === "disabled")).toBe(
      true,
    );
  });

  it("preserves query cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new DOMException("aborted", "AbortError"));

    await expect(fetchConfig(controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });
});
