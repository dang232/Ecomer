import { describe, expect, it, vi } from "vitest";

vi.mock("../client", () => ({
  api: { get: vi.fn() },
}));

import { api } from "../client";

import { categoryTree } from "./categories";

describe("categoryTree", () => {
  it("keeps names, labels, parents, and nested children from product-service", async () => {
    vi.mocked(api.get).mockResolvedValue([
      {
        id: "electronics",
        name: "Electronics",
        label: "Electronics",
        parentId: null,
        children: [
          { id: "phones", name: "Phones", label: "Phones", parentId: "electronics", children: [] },
        ],
      },
    ]);

    await expect(categoryTree()).resolves.toEqual([
      {
        id: "electronics",
        name: "Electronics",
        label: "Electronics",
        parentId: null,
        children: [
          { id: "phones", name: "Phones", label: "Phones", parentId: "electronics", children: [] },
        ],
      },
    ]);
  });
});
