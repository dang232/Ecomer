import { describe, expect, it } from "vitest";

import {
  readSellerOrdersRouteState,
  readSellerProductsRouteState,
  writeSellerOrdersRouteState,
} from "./seller-route-state";

describe("seller route state", () => {
  it("normalizes order search and selected identifiers", () => {
    expect(readSellerOrdersRouteState("?q=%20phone%20&selected=sub-1")).toEqual({
      q: "phone",
      selected: "sub-1",
    });
  });

  it("bounds list pages and preserves unrelated query values", () => {
    expect(readSellerProductsRouteState("?page=-4&q=headphones")).toEqual({
      page: 1,
      q: "headphones",
      selected: "",
    });
    expect(writeSellerOrdersRouteState("?campaign=summer", { q: "phone" }).toString()).toBe(
      "campaign=summer&q=phone",
    );
  });
});
