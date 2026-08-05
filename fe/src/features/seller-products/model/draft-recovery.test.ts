import { describe, expect, it, vi } from "vitest";

import {
  clearDraftRecovery,
  draftRecoveryKey,
  getDraftRecovery,
  saveDraftRecovery,
} from "./draft-recovery";
import type { SellerProductForm } from "./product-form";

const sampleProductId = "prod-123";
const sampleFormValues = {
  name: "Draft Product",
  description: "A draft description",
  categoryId: "electronics",
  brand: "TestBrand",
  tags: ["test"],
  images: [],
  offerMode: "single",
  offer: { sku: "SKU-1", priceAmount: 990000, stockQuantity: 5 },
  variants: [],
} satisfies SellerProductForm;

// ── sessionStorage mock ─────────────────────────────────────────────────────────

const storage = new Map<string, string>();

vi.stubGlobal("sessionStorage", {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
});

describe("draftRecoveryKey", () => {
  it("is stable and namespaced", () => {
    expect(draftRecoveryKey).toBe("seller-products-draft-v1");
  });
});

describe("saveDraftRecovery", () => {
  it("stores a versioned record keyed by productId", () => {
    saveDraftRecovery(sampleProductId, sampleFormValues);
    const raw = storage.get(draftRecoveryKey);
    expect(raw).not.toBeNull();
    expect(raw).toContain(`"productId":"${sampleProductId}"`);
    expect(raw).toContain('"name":"Draft Product"');
  });
});

describe("getDraftRecovery", () => {
  it("returns the record when it exists", () => {
    saveDraftRecovery(sampleProductId, sampleFormValues);
    const result = getDraftRecovery();
    expect(result).not.toBeNull();
    expect(result!.productId).toBe(sampleProductId);
    expect(result!.formValues.name).toBe("Draft Product");
  });

  it("returns null when nothing is stored", () => {
    storage.clear();
    expect(getDraftRecovery()).toBeNull();
  });

  it("returns null for a malformed JSON record", () => {
    storage.set(draftRecoveryKey, "not-json{");
    expect(getDraftRecovery()).toBeNull();
  });

  it("returns null for a record missing the magic key", () => {
    storage.set(draftRecoveryKey, JSON.stringify({ productId: "x", formValues: {} }));
    expect(getDraftRecovery()).toBeNull();
  });

  it("returns null for a record with a wrong version", () => {
    const record = { _version: "999.0.0", productId: "x", formValues: {} };
    storage.set(draftRecoveryKey, JSON.stringify(record));
    expect(getDraftRecovery()).toBeNull();
  });

  it("migrates a version 1 backend-shaped draft into a single offer", () => {
    storage.set(
      draftRecoveryKey,
      JSON.stringify({
        _version: "1",
        productId: sampleProductId,
        formValues: {
          name: "Draft Product",
          categoryId: "electronics",
          images: [],
          variants: [{ sku: "SKU-1", name: "Standard", priceAmount: 990000, stockQuantity: 5 }],
        },
      }),
    );

    const recovered = getDraftRecovery();
    expect(recovered?.productId).toBe(sampleProductId);
    expect(recovered?.formValues.offerMode).toBe("single");
    expect(recovered?.formValues.offer).toEqual({
      sku: "SKU-1",
      priceAmount: 990000,
      stockQuantity: 5,
    });
  });
});

describe("clearDraftRecovery", () => {
  it("removes the stored record", () => {
    saveDraftRecovery(sampleProductId, sampleFormValues);
    expect(getDraftRecovery()).not.toBeNull();
    clearDraftRecovery();
    expect(getDraftRecovery()).toBeNull();
  });
});
