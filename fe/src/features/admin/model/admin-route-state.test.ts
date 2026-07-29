import { describe, expect, it } from "vitest";

import { readAdminOrdersRouteState, writeAdminOrdersRouteState } from "./admin-route-state";

describe("admin route state", () => {
  it("normalizes unsupported order filters", () => {
    expect(readAdminOrdersRouteState("?page=-4&status=SHIPPED&selected=order-1")).toEqual({
      page: 1,
      q: "",
      status: "SHIPPED",
      selected: "order-1",
    });
    expect(readAdminOrdersRouteState("?status=unknown").status).toBe("all");
  });

  it("omits defaults while preserving unrelated parameters", () => {
    expect(writeAdminOrdersRouteState("?campaign=summer&page=4", { page: 1 }).toString()).toBe(
      "campaign=summer",
    );
  });
});
