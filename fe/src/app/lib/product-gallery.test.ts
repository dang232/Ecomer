import { describe, expect, it } from "vitest";

import { buildGalleryImages } from "./product-gallery";

describe("buildGalleryImages", () => {
  it("keeps the selected variant first and removes duplicate or blank URLs", () => {
    expect(buildGalleryImages("same.jpg", ["", "same.jpg", "other.jpg", "other.jpg"])).toEqual([
      "same.jpg",
      "other.jpg",
    ]);
  });
});
