import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/api/client", () => ({
  api: { get: vi.fn() },
}));

import { api } from "@/shared/api/client";

import { categoryTree, flattenCategoryTree } from "@/shared/api/endpoints/categories";

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

  it("flattens nested categories for filters and labels", () => {
    expect(
      flattenCategoryTree([
        {
          id: "electronics",
          label: "Electronics",
          children: [
            {
              id: "phones",
              label: "Phones",
              parentId: "electronics",
              children: [{ id: "android", label: "Android", parentId: "phones" }],
            },
          ],
        },
      ]),
    ).toEqual([
      expect.objectContaining({ id: "electronics" }),
      expect.objectContaining({ id: "phones" }),
      expect.objectContaining({ id: "android" }),
    ]);
  });
});
