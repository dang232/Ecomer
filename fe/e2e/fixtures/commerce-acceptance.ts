import type { APIRequestContext } from "@playwright/test";
import { z } from "zod";

export interface AcceptanceRoute {
  path: string;
  persona: "public" | "buyer" | "seller" | "admin";
  states: readonly ("loading" | "empty" | "partial" | "error" | "ready" | "pending" | "success")[];
  viewports: readonly ("mobile" | "tablet" | "desktop" | "wide")[];
}

const productListSchema = z.object({
  data: z.object({
    content: z.array(z.object({ id: z.string().min(1) })).min(1),
  }),
});

export const COMMERCE_ACCEPTANCE = [
  {
    path: "/",
    persona: "public",
    states: ["loading", "partial", "ready"],
    viewports: ["mobile", "tablet", "desktop", "wide"],
  },
  {
    path: "/search?q=phone",
    persona: "public",
    states: ["loading", "empty", "error", "ready"],
    viewports: ["mobile", "tablet", "desktop", "wide"],
  },
  {
    path: "/product/{seededProductId}",
    persona: "public",
    states: ["loading", "error", "ready"],
    viewports: ["mobile", "tablet", "desktop", "wide"],
  },
  {
    path: "/sellers/{acceptanceSellerId}",
    persona: "public",
    states: ["loading", "error", "ready"],
    viewports: ["mobile", "desktop"],
  },
  {
    path: "/cart",
    persona: "buyer",
    states: ["loading", "empty", "error", "ready", "pending"],
    viewports: ["mobile", "desktop"],
  },
  {
    path: "/checkout",
    persona: "buyer",
    states: ["loading", "empty", "error", "ready", "pending", "success"],
    viewports: ["mobile", "desktop"],
  },
  {
    path: "/payment/return/vnpay",
    persona: "buyer",
    states: ["loading", "error", "ready", "success"],
    viewports: ["mobile", "desktop"],
  },
  {
    path: "/orders",
    persona: "buyer",
    states: ["loading", "empty", "error", "ready", "pending"],
    viewports: ["mobile", "desktop"],
  },
  {
    path: "/orders/{acceptanceOrderId}",
    persona: "buyer",
    states: ["loading", "error", "ready", "pending"],
    viewports: ["mobile", "desktop"],
  },
  {
    path: "/returns",
    persona: "buyer",
    states: ["loading", "empty", "error", "ready"],
    viewports: ["mobile", "desktop"],
  },
  {
    path: "/returns/new?orderId={acceptanceOrderId}",
    persona: "buyer",
    states: ["loading", "error", "ready", "pending", "success"],
    viewports: ["mobile", "desktop"],
  },
  {
    path: "/profile",
    persona: "buyer",
    states: ["loading", "error", "ready", "pending", "success"],
    viewports: ["mobile", "desktop"],
  },
  {
    path: "/wishlist",
    persona: "buyer",
    states: ["loading", "empty", "error", "ready", "pending"],
    viewports: ["mobile", "desktop"],
  },
  {
    path: "/messages",
    persona: "buyer",
    states: ["loading", "empty", "error", "ready", "pending"],
    viewports: ["mobile", "desktop"],
  },
  {
    path: "/notifications",
    persona: "buyer",
    states: ["loading", "empty", "error", "ready", "pending"],
    viewports: ["mobile", "desktop"],
  },
  {
    path: "/notifications/preferences",
    persona: "buyer",
    states: ["loading", "error", "ready", "pending", "success"],
    viewports: ["mobile", "desktop"],
  },
  {
    path: "/seller",
    persona: "seller",
    states: ["loading", "partial", "error", "ready"],
    viewports: ["mobile", "desktop"],
  },
  {
    path: "/seller/products",
    persona: "seller",
    states: ["loading", "empty", "error", "ready", "pending", "success"],
    viewports: ["mobile", "desktop"],
  },
  {
    path: "/seller/orders",
    persona: "seller",
    states: ["loading", "empty", "error", "ready", "pending"],
    viewports: ["mobile", "desktop"],
  },
  {
    path: "/seller/reviews",
    persona: "seller",
    states: ["loading", "empty", "error", "ready", "pending"],
    viewports: ["mobile", "desktop"],
  },
  {
    path: "/seller/wallet",
    persona: "seller",
    states: ["loading", "empty", "error", "ready", "pending"],
    viewports: ["mobile", "desktop"],
  },
  {
    path: "/seller/settings",
    persona: "seller",
    states: ["loading", "error", "ready"],
    viewports: ["mobile", "desktop"],
  },
  {
    path: "/admin",
    persona: "admin",
    states: ["loading", "partial", "error", "ready"],
    viewports: ["mobile", "desktop"],
  },
  {
    path: "/admin/sellers",
    persona: "admin",
    states: ["loading", "empty", "error", "ready", "pending"],
    viewports: ["mobile", "desktop"],
  },
  {
    path: "/admin/reviews",
    persona: "admin",
    states: ["loading", "empty", "error", "ready", "pending"],
    viewports: ["mobile", "desktop"],
  },
  {
    path: "/admin/video",
    persona: "admin",
    states: ["loading", "empty", "error", "ready", "pending"],
    viewports: ["mobile", "desktop"],
  },
  {
    path: "/admin/coupons",
    persona: "admin",
    states: ["loading", "empty", "error", "ready", "pending", "success"],
    viewports: ["mobile", "desktop"],
  },
  {
    path: "/admin/disputes",
    persona: "admin",
    states: ["loading", "empty", "error", "ready", "pending"],
    viewports: ["mobile", "desktop"],
  },
  {
    path: "/admin/payouts",
    persona: "admin",
    states: ["loading", "empty", "error", "ready", "pending"],
    viewports: ["mobile", "desktop"],
  },
  {
    path: "/admin/users",
    persona: "admin",
    states: ["loading", "empty", "error", "ready", "pending"],
    viewports: ["mobile", "desktop"],
  },
  {
    path: "/admin/orders",
    persona: "admin",
    states: ["loading", "empty", "error", "ready", "pending"],
    viewports: ["mobile", "desktop"],
  },
  {
    path: "/admin/health",
    persona: "admin",
    states: ["loading", "partial", "error", "ready"],
    viewports: ["mobile", "desktop"],
  },
] as const satisfies readonly AcceptanceRoute[];

export const ACCEPTANCE_VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1024, height: 768 },
  wide: { width: 1440, height: 900 },
} as const;

export async function resolveAcceptancePath(
  request: APIRequestContext,
  path: string,
): Promise<string> {
  const fixed = path
    .replace("{acceptanceOrderId}", "00000000-0000-4000-8000-000000000001")
    .replace("{acceptanceSellerId}", "00000000-0000-4000-8000-000000000002");
  if (!fixed.includes("{seededProductId}")) return fixed;
  const apiURL = process.env.VITE_E2E_API_URL ?? "http://localhost:8080";
  const response = await request.get(`${apiURL}/products?size=1`);
  if (!response.ok()) {
    throw new Error(`Cannot resolve a seeded product: HTTP ${response.status()}`);
  }
  const payload: unknown = await response.json();
  const productId = productListSchema.parse(payload).data.content[0].id;
  return fixed.replace("{seededProductId}", encodeURIComponent(productId));
}
