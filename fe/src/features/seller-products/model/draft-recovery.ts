/**
 * Versioned draft recovery for the seller product editor.
 *
 * A product is created as a DRAFT before it can be published. The active
 * catalog cannot read that draft back, so this short-lived record preserves
 * the editor state and its product ID for the current browser session.
 */

import { z } from "zod";

import { migrateLegacySellerProductForm, sellerProductFormSchema } from "./product-form";

const MAGIC_KEY = "seller-products-draft-v1";

/** sessionStorage key, kept stable so version 1 drafts can be migrated. */
export const draftRecoveryKey = `${MAGIC_KEY}`;

const recordSchema = z.object({
  _version: z.literal("2"),
  productId: z.string().min(1),
  formValues: sellerProductFormSchema,
});

const legacyRecordSchema = z.object({
  _version: z.literal("1"),
  productId: z.string().min(1),
  formValues: z.object({
    name: z.string(),
    description: z.string().optional(),
    categoryId: z.string().optional(),
    brand: z.string().optional(),
    tags: z.array(z.string()).optional(),
    images: z
      .array(
        z.object({
          url: z.string(),
          alt: z.string().optional(),
          sortOrder: z.number().optional(),
        }),
      )
      .optional(),
    variants: z.array(
      z.object({
        sku: z.string().optional(),
        name: z.string().optional(),
        priceAmount: z.number().optional(),
        stockQuantity: z.number().optional(),
        imageUrl: z.string().optional(),
      }),
    ),
  }),
});

type DraftRecord = z.infer<typeof recordSchema>;

/** Persist a versioned record immediately after a product draft is created. */
export function saveDraftRecovery(
  productId: string,
  formValues: z.infer<typeof sellerProductFormSchema>,
): void {
  const record: DraftRecord = { _version: "2", productId, formValues };
  try {
    sessionStorage.setItem(draftRecoveryKey, JSON.stringify(record));
  } catch {
    // Private-mode storage can be unavailable. The editor remains usable.
  }
}

/** Read the current record or upgrade a pre-offer-model draft in memory. */
export function getDraftRecovery(): {
  productId: string;
  formValues: z.infer<typeof sellerProductFormSchema>;
} | null {
  try {
    const raw = sessionStorage.getItem(draftRecoveryKey);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const current = recordSchema.safeParse(parsed);
    if (current.success) {
      return { productId: current.data.productId, formValues: current.data.formValues };
    }
    const legacy = legacyRecordSchema.safeParse(parsed);
    if (legacy.success) {
      return {
        productId: legacy.data.productId,
        formValues: migrateLegacySellerProductForm(legacy.data.formValues),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Remove the stored draft after publish or deletion succeeds. */
export function clearDraftRecovery(): void {
  try {
    sessionStorage.removeItem(draftRecoveryKey);
  } catch {
    // Ignore unavailable session storage.
  }
}
