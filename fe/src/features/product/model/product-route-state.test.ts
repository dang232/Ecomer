import { describe, expect, it } from "vitest";

import { readProductRouteState, updateProductRouteState } from "./product-route-state";

describe("product route state", () => {
  it("normalizes a product section and selected SKU from the URL", () => {
    expect(readProductRouteState("?section=reviews&variant=SKU-BLUE")).toEqual({
      section: "reviews",
      variant: "SKU-BLUE",
    });
  });

  it("drops invalid sections and serializes supported state", () => {
    expect(readProductRouteState("?section=unknown&variant=".concat("x".repeat(200)))).toEqual({
      section: "details",
      variant: "x".repeat(100),
    });
    expect(String(updateProductRouteState("?section=details", { section: "videos" }))).toBe(
      "section=videos",
    );
  });
});
