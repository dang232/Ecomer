import { describe, expect, it } from "vitest";

import { MODERNIZED_COMMERCE_ROUTE_PATHS } from "./commerce-route-inventory";
import { router } from "./routes";

describe("application routes", () => {
  it("registers an authenticated order detail route", () => {
    const root = router.routes.find((route) => route.path === "/");
    const orderDetailRoute = root?.children?.find((route) => route.path === "orders/:id");

    expect(orderDetailRoute).toBeDefined();
  });

  it("declares explicit seller and admin child routes", () => {
    const seller = router.routes.find((route) => route.path === "/seller");
    const admin = router.routes.find((route) => route.path === "/admin");

    expect(seller?.children?.map((route) => route.path ?? "index")).toEqual([
      "index",
      "products",
      "orders",
      "returns",
      "reviews",
      "wallet",
      "settings",
    ]);
    expect(admin?.children?.map((route) => route.path ?? "index")).toEqual([
      "index",
      "orders",
      "coupons",
      "sellers",
      "reviews",
      "video",
      "disputes",
      "payouts",
      "users",
      "health",
    ]);
  });

  it("tracks every modernized commerce route as acceptance metadata", () => {
    expect(MODERNIZED_COMMERCE_ROUTE_PATHS).toContain("/seller/orders");
    expect(MODERNIZED_COMMERCE_ROUTE_PATHS).toContain("/admin/health");
    expect(MODERNIZED_COMMERCE_ROUTE_PATHS).toContain("/payment/return/vnpay");
  });
});
