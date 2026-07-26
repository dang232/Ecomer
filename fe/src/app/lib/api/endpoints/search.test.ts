import { describe, expect, it, vi } from "vitest";

vi.mock("../client", () => ({
  api: {
    getWithMeta: vi.fn().mockResolvedValue({ data: { items: [], hasMore: false, nextCursor: null } }),
    get: vi.fn(),
  },
}));

import { api } from "../client";
import { searchProductsV2 } from "./search";

describe("searchProductsV2", () => {
  it("passes rating and repeated tag filters to the backend", async () => {
    await searchProductsV2({ minRating: 4, tags: ["wireless", "bluetooth"] });

    expect(api.getWithMeta).toHaveBeenCalledWith(
      "/search/v2",
      expect.anything(),
      expect.objectContaining({ minRating: 4, tag: ["wireless", "bluetooth"] }),
      expect.objectContaining({ auth: false }),
    );
  });
});
