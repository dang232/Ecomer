/**
 * Versioned draft recovery for the seller product editor.
 *
 * On successful creation (POST /sellers/me/products) the BE returns a DRAFT product.
 * The ACTIVE catalog list cannot refetch it. We immediately persist the returned
 * product ID + validated form values in sessionStorage so:
 *
 *  - The editor can stay open and surface a publication recovery surface.
 *  - A page reload can restore the editor state and form values.
 *
 * Format: { _version: "1", productId: string, formValues: SellerProductForm }
 * The magic "_version" key guards against accidentally reading stale shapes.
 */

import { z } from "zod";

import { sellerProductFormSchema } from "./product-form";

const MAGIC_KEY = "seller-products-draft-v1";

/** sessionStorage key — prefixed so multiple seller features can coexist. */
export const draftRecoveryKey = `${MAGIC_KEY}`;

const recordSchema = z.object({
  _version: z.literal("1"),
  productId: z.string().min(1),
  formValues: sellerProductFormSchema,
});

type DraftRecord = z.infer<typeof recordSchema>;

/**
 * Persist a versioned record to sessionStorage.
 * Call immediately after POST /sellers/me/products succeeds with the new product ID.
 */
export function saveDraftRecovery(
  productId: string,
  formValues: z.infer<typeof sellerProductFormSchema>,
): void {
  const record: DraftRecord = { _version: "1", productId, formValues };
  try {
    sessionStorage.setItem(draftRecoveryKey, JSON.stringify(record));
  } catch {
    // sessionStorage may be unavailable (private browsing quota, etc.) — degrade silently.
  }
}

/**
 * Read and validate the stored draft record.
 * Returns null if nothing is stored, JSON is malformed, or the shape is unrecognised.
 */
export function getDraftRecovery(): {
  productId: string;
  formValues: z.infer<typeof sellerProductFormSchema>;
} | null {
  try {
    const raw = sessionStorage.getItem(draftRecoveryKey);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const result = recordSchema.safeParse(parsed);
    if (!result.success) return null;
    const data = result.data;
    return { productId: data.productId, formValues: data.formValues };
  } catch {
    return null;
  }
}

/**
 * Remove the stored draft record.
 * Call after publish or delete succeeds.
 */
export function clearDraftRecovery(): void {
  try {
    sessionStorage.removeItem(draftRecoveryKey);
  } catch {
    // Ignore.
  }
}
