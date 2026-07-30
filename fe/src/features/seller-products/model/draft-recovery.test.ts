import { describe, expect, it, vi } from "vitest";

import {
  clearDraftRecovery,
  draftRecoveryKey,
  getDraftRecovery,
  saveDraftRecovery,
} from "./draft-recovery";

const sampleProductId = "prod-123";
const sampleFormValues = {
  name: "Draft Product",
  description: "A draft description",
  categoryId: "electronics",
  brand: "TestBrand",
  tags: ["test"],
  images: [],
  variants: [{ sku: "SKU-1", name: "Variant 1", priceAmount: 990000, stockQuantity: 5 }],
};

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
    const parsed = JSON.parse(raw!) as { productId: string; formValues: { name: string } };
    expect(parsed.productId).toBe(sampleProductId);
    expect(parsed.formValues.name).toBe("Draft Product");
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
});

describe("clearDraftRecovery", () => {
  it("removes the stored record", () => {
    saveDraftRecovery(sampleProductId, sampleFormValues);
    expect(getDraftRecovery()).not.toBeNull();
    clearDraftRecovery();
    expect(getDraftRecovery()).toBeNull();
  });
});
