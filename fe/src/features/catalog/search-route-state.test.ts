import { describe, expect, it } from "vitest";

import {
  clearSearchFilters,
  readSearchRouteState,
  updateSearchRouteState,
} from "./search-route-state";

describe("search route state", () => {
  it("parses every applied filter and pagination value", () => {
    expect(
      readSearchRouteState(
        new URLSearchParams(
          "q=headphones&cat=electronics&brand=Acme&priceMin=2&priceMax=20&minRating=4&freeShip=true&sameDay=true&verifiedOnly=true&officialOnly=true&sort=price-low&page=3&flash=true",
        ),
      ),
    ).toEqual({
      q: "headphones",
      cat: "electronics",
      brand: "Acme",
      priceMin: "2",
      priceMax: "20",
      minRating: 4,
      freeShip: true,
      sameDay: true,
      verifiedOnly: true,
      officialOnly: true,
      sort: "price-low",
      page: 3,
      flash: true,
    });
  });

  it("normalizes unsupported values instead of leaking invalid UI state", () => {
    const state = readSearchRouteState(
      new URLSearchParams("minRating=99&sort=rating&page=-4&freeShip=yes"),
    );

    expect(state.minRating).toBe(5);
    expect(state.sort).toBe("popular");
    expect(state.page).toBe(1);
    expect(state.freeShip).toBe(false);
  });

  it("resets pagination when an applied filter changes", () => {
    const next = updateSearchRouteState(new URLSearchParams("q=phone&page=8"), {
      officialOnly: true,
    });

    expect(next.get("q")).toBe("phone");
    expect(next.get("officialOnly")).toBe("true");
    expect(next.has("page")).toBe(false);
  });

  it("can update pagination without resetting itself", () => {
    const next = updateSearchRouteState(
      new URLSearchParams("q=phone&officialOnly=true"),
      { page: 4 },
      { resetPage: false },
    );

    expect(next.get("page")).toBe("4");
    expect(next.get("officialOnly")).toBe("true");
  });

  it("clears filters while retaining the search and campaign context", () => {
    const next = clearSearchFilters(
      new URLSearchParams("q=phone&flash=true&cat=electronics&priceMin=2&officialOnly=true&page=4"),
    );

    expect(next.toString()).toBe("q=phone&flash=true");
  });
});
