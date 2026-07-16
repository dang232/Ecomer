import { describe, expect, it } from "vitest";

import { readRouteState, routeParam, writeRouteState } from "./route-state";

const searchSchema = {
  query: routeParam.string({ defaultValue: "", maxLength: 80 }),
  page: routeParam.integer({ defaultValue: 1, min: 1, max: 100 }),
  sort: routeParam.enum(["popular", "price-asc", "price-desc"] as const, "popular"),
  flash: routeParam.boolean(false),
};

describe("route state", () => {
  it("parses valid values into a typed state", () => {
    const state = readRouteState(
      new URLSearchParams("query=wireless+headphones&page=3&sort=price-desc&flash=true"),
      searchSchema,
    );

    expect(state).toEqual({
      query: "wireless headphones",
      page: 3,
      sort: "price-desc",
      flash: true,
    });
  });

  it("normalizes malformed, blank, and out-of-range values", () => {
    const state = readRouteState(
      new URLSearchParams("query=+++&page=-4&sort=unknown&flash=yes"),
      searchSchema,
    );

    expect(state).toEqual({ query: "", page: 1, sort: "popular", flash: false });
  });

  it("limits untrusted string and integer values", () => {
    const state = readRouteState(
      new URLSearchParams(`query=${"a".repeat(120)}&page=999999`),
      searchSchema,
    );

    expect(state.query).toHaveLength(80);
    expect(state.page).toBe(100);
  });

  it("updates owned parameters, omits defaults, and preserves unrelated state", () => {
    const next = writeRouteState(
      new URLSearchParams("campaign=summer&page=4&sort=price-asc"),
      searchSchema,
      { page: 1, sort: "price-desc", flash: true },
    );

    expect(next.get("campaign")).toBe("summer");
    expect(next.has("page")).toBe(false);
    expect(next.get("sort")).toBe("price-desc");
    expect(next.get("flash")).toBe("true");
  });
});
