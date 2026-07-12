import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchConfig } from "./use-app-config";

const validConfig = {
  brand: { name: "VNShop", tagline: "MARKETPLACE", logoUrl: "" },
  social: {
    facebook: "https://facebook.com",
    instagram: "https://instagram.com",
    twitter: "https://x.com",
    youtube: "https://youtube.com",
  },
  payment: { providers: ["COD"], defaultMethod: "COD" },
  features: { flashSale: true, messaging: true, notifications: true, reviews: true },
  support: { phone: "1900-0000", email: "support@vnshop.vn", hours: "24/7" },
  websocket: {
    notificationsPath: "/ws/notifications",
    messagingPath: "/ws/messaging",
    maxReconnectAttempts: 5,
    reconnectBaseMs: 2000,
    reconnectCapMs: 30000,
  },
};

describe("fetchConfig", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the public gateway when no frontend URL is configured", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(validConfig), { status: 200 }));

    await expect(fetchConfig()).resolves.toEqual(validConfig);

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8080/api/config");
  });

  it("falls back when the response does not match the configuration contract", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ brand: { name: "incomplete" } }), { status: 200 }),
    );

    await expect(fetchConfig()).resolves.toMatchObject({
      brand: { name: "VNShop" },
      payment: { defaultMethod: "COD" },
    });
  });
});
