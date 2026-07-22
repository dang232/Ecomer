import { describe, expect, it } from "vitest";

import type { ProductDetail, ProductSummary } from "../../types/api";
import type { ProductId } from "../../types/api/branded-ids";

import { fromServer, pct } from "./product-mapper";

// ---------------------------------------------------------------------------
// pct
// ---------------------------------------------------------------------------
describe("pct", () => {
  it("returns undefined when originalPrice is missing", () => {
    expect(pct(undefined, 80)).toBeUndefined();
  });

  it("returns undefined when price is missing", () => {
    expect(pct(100, undefined)).toBeUndefined();
  });

  it("returns undefined when current >= original", () => {
    expect(pct(100, 100)).toBeUndefined();
    expect(pct(80, 100)).toBeUndefined();
  });

  it("returns rounded percent when current < original", () => {
    expect(pct(100, 75)).toBe(25);
    // 66.666… rounds to 67
    expect(pct(3, 1)).toBe(67);
  });
});

// ---------------------------------------------------------------------------
// fromServer — ProductSummary (detail-only fields collapse to defaults)
// ---------------------------------------------------------------------------
describe("fromServer with ProductSummary", () => {
  const summary: ProductSummary = { id: "p1" as ProductId, name: "Test Product", price: 100 };

  it("collapses detail-only fields to defaults", () => {
    const result = fromServer(summary);
    expect(result.description).toBe("");
    expect(result.tags).toEqual([]);
    expect(result.colors).toBeUndefined();
    expect(result.sizes).toBeUndefined();
  });

  it("preserves server rating data for cards and rating filters", () => {
    const result = fromServer({ ...summary, rating: 4, reviewCount: 1 });
    expect(result.rating).toBe(4);
    expect(result.reviewCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// fromServer — ProductDetail (detail fields are preserved)
// ---------------------------------------------------------------------------
describe("fromServer with ProductDetail", () => {
  const detail: ProductDetail = {
    id: "p2" as ProductId,
    name: "Detail Product",
    price: 200,
    description: "A detailed description",
    colors: ["red", "blue"],
    sizes: ["S", "M", "L"],
    tags: ["sale", "new"],
  };

  it("preserves detail fields", () => {
    const result = fromServer(detail);
    expect(result.description).toBe("A detailed description");
    expect(result.colors).toEqual(["red", "blue"]);
    expect(result.sizes).toEqual(["S", "M", "L"]);
    expect(result.tags).toEqual(["sale", "new"]);
  });
});

// ---------------------------------------------------------------------------
// fromServer — image flattening
// ---------------------------------------------------------------------------
describe("fromServer image flattening", () => {
  it("flattens object entries with .url", () => {
    const p: ProductSummary = {
      id: "p3" as ProductId,
      name: "P",
      images: [{ url: "https://cdn/a.jpg" }, { url: "https://cdn/b.jpg" }],
    };
    expect(fromServer(p).images).toEqual(["https://cdn/a.jpg", "https://cdn/b.jpg"]);
  });

  it("flattens plain string entries", () => {
    const p: ProductSummary = {
      id: "p4" as ProductId,
      name: "P",
      images: ["https://cdn/c.jpg", "https://cdn/d.jpg"],
    };
    expect(fromServer(p).images).toEqual(["https://cdn/c.jpg", "https://cdn/d.jpg"]);
  });

  it("falls back to top-level image when images array is empty", () => {
    const p: ProductSummary = {
      id: "p5" as ProductId,
      name: "P",
      images: [],
      image: "https://cdn/fallback.jpg",
    };
    expect(fromServer(p).images).toEqual(["https://cdn/fallback.jpg"]);
  });
});

// ---------------------------------------------------------------------------
// fromServer — variant price fallback
// ---------------------------------------------------------------------------
describe("fromServer variant price fallback", () => {
  it("takes price from variants[0].priceAmount when no top-level price", () => {
    const p: ProductSummary = {
      id: "p6" as ProductId,
      name: "P",
      variants: [{ priceAmount: 150 }],
    };
    expect(fromServer(p).price).toBe(150);
  });
});
