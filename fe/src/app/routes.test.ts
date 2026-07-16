import { describe, expect, it } from "vitest";

import { router } from "./routes";

describe("application routes", () => {
  it("registers an authenticated order detail route", () => {
    const root = router.routes.find((route) => route.path === "/");
    const orderDetailRoute = root?.children?.find((route) => route.path === "orders/:id");

    expect(orderDetailRoute).toBeDefined();
  });
});
