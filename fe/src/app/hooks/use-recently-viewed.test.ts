import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useRecentlyViewed } from "./use-recently-viewed";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("useRecentlyViewed", () => {
  it("clears malformed stored items instead of exposing them to the UI", async () => {
    localStorage.setItem(
      "vnshop:recently-viewed",
      JSON.stringify([{ productId: "product-1", name: "Headphones", price: "free" }]),
    );

    const { result } = renderHook(() => useRecentlyViewed());

    await waitFor(() => expect(localStorage.getItem("vnshop:recently-viewed")).toBeNull());
    expect(result.current.items).toEqual([]);
  });
});
