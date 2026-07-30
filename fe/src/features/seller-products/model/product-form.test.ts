import { describe, expect, it } from "vitest";

import { sellerProductFormSchema, toSellerProductWriteBody } from "./product-form";

const validForm = {
  name: "Phone",
  description: "A great phone",
  categoryId: "electronics",
  brand: "VN",
  tags: ["smartphone"],
  images: [{ url: "https://example.com/phone.jpg", alt: "Phone", sortOrder: 0 }],
  variants: [{ sku: "SKU-001", name: "Blue", priceAmount: 990000, stockQuantity: 10 }],
};

describe("sellerProductFormSchema", () => {
  it("accepts a valid form", () => {
    const result = sellerProductFormSchema.safeParse(validForm);
    expect(result.success).toBe(true);
  });

  it("rejects a name shorter than 2 characters", () => {
    const result = sellerProductFormSchema.safeParse({ ...validForm, name: "X" });
    expect(result.success).toBe(false);
  });

  it("rejects a description longer than 5000 characters", () => {
    const result = sellerProductFormSchema.safeParse({ ...validForm, description: "x".repeat(5001) });
    expect(result.success).toBe(false);
  });

  it("rejects more than 20 tags", () => {
    const result = sellerProductFormSchema.safeParse({ ...validForm, tags: Array(21).fill("tag") });
    expect(result.success).toBe(false);
  });

  it("rejects more than 12 images", () => {
    const result = sellerProductFormSchema.safeParse({
      ...validForm,
      images: Array(13).fill({ url: "https://example.com/img.jpg", sortOrder: 0 }),
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero variants", () => {
    const result = sellerProductFormSchema.safeParse({ ...validForm, variants: [] });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid variant beside the variant fields", () => {
    const result = sellerProductFormSchema.safeParse({
      name: "Phone",
      description: "",
      categoryId: "phones",
      brand: "VN",
      tags: [],
      images: [],
      variants: [{ sku: "", name: "Blue", priceAmount: -1, stockQuantity: -2 }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.variants).toBeDefined();
    }
  });

  it("accepts a variant with optional imageUrl", () => {
    const result = sellerProductFormSchema.safeParse({
      ...validForm,
      variants: [{ sku: "SKU-002", name: "Red", priceAmount: 990000, stockQuantity: 5, imageUrl: "https://example.com/red.jpg" }],
    });
    expect(result.success).toBe(true);
  });
});

describe("toSellerProductWriteBody", () => {
  it("maps form values to the existing write contract", () => {
    const result = toSellerProductWriteBody(validForm);
    expect(result).toEqual({
      name: validForm.name,
      description: validForm.description,
      categoryId: validForm.categoryId,
      brand: validForm.brand,
      tags: validForm.tags,
      images: validForm.images,
      variants: validForm.variants.map((variant) => ({ ...variant, priceCurrency: "VND" })),
    });
  });

  it("omits undefined optional fields", () => {
    const minimalForm = {
      name: "Item",
      description: "",
      categoryId: "cat",
      brand: "",
      tags: [],
      images: [],
      variants: [{ sku: "S1", name: "One", priceAmount: 100, stockQuantity: 1 }],
    };
    const result = toSellerProductWriteBody(minimalForm);
    expect(result.brand).toBeUndefined();
    expect(result.description).toBeUndefined();
    expect(result.images).toBeUndefined();
  });
});
