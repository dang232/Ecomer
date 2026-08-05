import { describe, expect, it } from "vitest";

import { readAdminQueueRouteState, writeAdminQueueRouteState } from "./admin-queue-route-state";

describe("admin queue route state", () => {
  it("normalizes page and selected values", () => {
    expect(readAdminQueueRouteState("?page=-2&q=buyer&status=PENDING&selected=order-1")).toEqual({
      page: 1,
      q: "buyer",
      status: "PENDING",
      selected: "order-1",
    });
  });

  it("preserves unrelated parameters while clearing queue defaults", () => {
    expect(
      writeAdminQueueRouteState("?campaign=summer&page=4&selected=order-1", {
        page: 1,
        selected: null,
      }).toString(),
    ).toBe("campaign=summer");
  });
});
