import { describe, expect, it } from "vitest";

import {
  fromSellerProduct,
  sellerProductFormSchema,
  toSellerProductWriteBody,
} from "./product-form";

const validForm = {
  name: "Phone",
  description: "A great phone",
  categoryId: "electronics",
  brand: "VN",
  tags: ["smartphone"],
  images: [{ url: "https://example.com/phone.jpg", alt: "Phone", sortOrder: 0 }],
  offerMode: "single" as const,
  offer: { sku: "PHONE-STD", priceAmount: 990000, stockQuantity: 10 },
  variants: [],
};

const completeParcel = {
  weightGrams: 500,
  lengthCm: 30,
  widthCm: 20,
  heightCm: 10,
};

describe("sellerProductFormSchema", () => {
  it("accepts a simple product with one seller-facing offer", () => {
    expect(sellerProductFormSchema.safeParse(validForm).success).toBe(true);
  });

  it("rejects a name shorter than 2 characters", () => {
    expect(sellerProductFormSchema.safeParse({ ...validForm, name: "X" }).success).toBe(false);
  });

  it("rejects a description longer than 2000 characters", () => {
    expect(
      sellerProductFormSchema.safeParse({ ...validForm, description: "x".repeat(2001) }).success,
    ).toBe(false);
  });

  it("requires at least one option only when the seller chooses option-based offers", () => {
    const result = sellerProductFormSchema.safeParse({
      ...validForm,
      offerMode: "variants",
      variants: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "variants")).toBe(true);
    }
  });

  it("allows blank merchant SKUs and enforces uniqueness only for provided SKUs", () => {
    const result = sellerProductFormSchema.safeParse({
      ...validForm,
      offerMode: "variants",
      variants: [
        { sku: "", name: "Blue", priceAmount: 990000, stockQuantity: 5 },
        { sku: "", name: "Black", priceAmount: 1_090_000, stockQuantity: 3 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects duplicate merchant SKUs case-insensitively", () => {
    const result = sellerProductFormSchema.safeParse({
      ...validForm,
      offerMode: "variants",
      variants: [
        { sku: "PHONE-1", name: "Blue", priceAmount: 990000, stockQuantity: 5 },
        { sku: "phone-1", name: "Black", priceAmount: 1_090_000, stockQuantity: 3 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects partial parcel metadata", () => {
    const result = sellerProductFormSchema.safeParse({
      ...validForm,
      offer: {
        ...validForm.offer,
        parcel: { weightGrams: completeParcel.weightGrams, lengthCm: completeParcel.lengthCm },
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects non-positive parcel metadata", () => {
    const result = sellerProductFormSchema.safeParse({
      ...validForm,
      offer: {
        ...validForm.offer,
        parcel: { ...completeParcel, widthCm: 0 },
      },
    });

    expect(result.success).toBe(false);
  });
});

describe("toSellerProductWriteBody", () => {
  it("translates a simple offer to the API's Standard variant", () => {
    expect(toSellerProductWriteBody(validForm)).toEqual({
      name: validForm.name,
      description: validForm.description,
      categoryId: validForm.categoryId,
      brand: validForm.brand,
      tags: validForm.tags,
      images: validForm.images,
      variants: [
        {
          sku: "PHONE-STD",
          name: "Standard",
          priceAmount: 990000,
          stockQuantity: 10,
          priceCurrency: "VND",
        },
      ],
    });
  });

  it("serializes complete parcel metadata for a single offer", () => {
    const result = toSellerProductWriteBody({
      ...validForm,
      offer: { ...validForm.offer, parcel: completeParcel },
    });

    expect(result.variants).toEqual([
      expect.objectContaining({ name: "Standard", parcel: completeParcel }),
    ]);
  });

  it("serializes complete parcel metadata for option-based offers", () => {
    const result = toSellerProductWriteBody({
      ...validForm,
      offerMode: "variants",
      variants: [
        {
          sku: "PHONE-BLUE",
          name: "Blue",
          priceAmount: 990000,
          stockQuantity: 5,
          parcel: completeParcel,
        },
      ],
    });

    expect(result.variants).toEqual([
      expect.objectContaining({ sku: "PHONE-BLUE", parcel: completeParcel }),
    ]);
  });

  it("creates stable, distinct SKUs for blank seller references", () => {
    const result = toSellerProductWriteBody({
      ...validForm,
      offer: { sku: "", priceAmount: 990000, stockQuantity: 10 },
      offerMode: "variants",
      variants: [
        { sku: "", name: "Blue", priceAmount: 990000, stockQuantity: 5 },
        { sku: "", name: "Blue", priceAmount: 1_090_000, stockQuantity: 3 },
      ],
    });

    expect(result.variants).toEqual([
      expect.objectContaining({ sku: "VNS-PHONE-BLUE-1", priceCurrency: "VND" }),
      expect.objectContaining({ sku: "VNS-PHONE-BLUE-2", priceCurrency: "VND" }),
    ]);
  });

  it("omits empty optional fields and browser-only image URLs", () => {
    const result = toSellerProductWriteBody({
      ...validForm,
      description: "",
      brand: "",
      tags: [],
      offer: {
        ...validForm.offer,
        parcel: {
          weightGrams: undefined,
          lengthCm: undefined,
          widthCm: undefined,
          heightCm: undefined,
        },
      },
      images: [
        { url: "blob:http://localhost/preview", alt: "local", sortOrder: 0 },
        { url: "https://cdn.example.com/phone.jpg", alt: "saved", sortOrder: 1 },
      ],
    });
    expect(result.description).toBeUndefined();
    expect(result.brand).toBeUndefined();
    expect(result.tags).toBeUndefined();
    expect(result.images).toEqual([
      { url: "https://cdn.example.com/phone.jpg", alt: "saved", sortOrder: 1 },
    ]);
    expect(result.variants?.[0]).not.toHaveProperty("parcel");
  });

  it("does not serialize a partial parcel object", () => {
    const result = toSellerProductWriteBody({
      ...validForm,
      offer: {
        ...validForm.offer,
        parcel: { weightGrams: completeParcel.weightGrams },
      },
    });

    expect(result.variants?.[0]).not.toHaveProperty("parcel");
  });
});

describe("fromSellerProduct", () => {
  it("shows a persisted Standard variant as a simple seller offer", () => {
    expect(
      fromSellerProduct({
        name: "Phone",
        description: "Details",
        categoryId: "electronics",
        brand: "VN",
        tags: ["audio"],
        images: ["https://cdn.example.com/phone.jpg"],
        variants: [
          {
            sku: "SKU-1",
            name: "Standard",
            priceAmount: 990000,
            stockQuantity: 4,
            parcel: completeParcel,
          },
        ],
      }),
    ).toEqual({
      name: "Phone",
      description: "Details",
      categoryId: "electronics",
      brand: "VN",
      tags: ["audio"],
      images: [{ url: "https://cdn.example.com/phone.jpg", sortOrder: 0 }],
      offerMode: "single",
      offer: { sku: "SKU-1", priceAmount: 990000, stockQuantity: 4, parcel: completeParcel },
      variants: [],
    });
  });

  it("keeps customer options distinct from the single-offer model", () => {
    const form = fromSellerProduct({
      name: "T-shirt",
      images: [],
      variants: [
        { sku: "TEE-S", name: "Small", priceAmount: 200000, stockQuantity: 3 },
        { sku: "TEE-M", name: "Medium", priceAmount: 200000, stockQuantity: 8 },
      ],
    });
    expect(form.offerMode).toBe("variants");
    expect(form.variants).toHaveLength(2);
  });

  it("preserves parcel metadata when editing option-based offers", () => {
    const form = fromSellerProduct({
      name: "T-shirt",
      images: [],
      variants: [
        {
          sku: "TEE-S",
          name: "Small",
          priceAmount: 200000,
          stockQuantity: 3,
          parcel: completeParcel,
        },
        { sku: "TEE-M", name: "Medium", priceAmount: 200000, stockQuantity: 8 },
      ],
    });

    expect(form.variants[0]?.parcel).toEqual(completeParcel);
  });
});
