import { z } from "zod";

/**
 * Branded Zod id types for the three highest-value domain ids.
 *
 * These are zero-cost at runtime — `z.string().brand<X>()` still produces a
 * plain string value. The brand is a compile-time nominal tag that prevents
 * accidental cross-domain id substitution (e.g. passing a SellerId where an
 * OrderId is expected).
 *
 * Usage:
 *   - At Zod parse boundaries (server response): branding is automatic.
 *   - At call sites with a raw string (URL param, user input):
 *       parse:  `orderIdSchema.parse(id)`   — validates + brands
 *       cast:   `id as OrderId`             — type-only, no runtime check
 */

export const orderIdSchema = z.string().brand<"OrderId">();
export type OrderId = z.infer<typeof orderIdSchema>;

export const productIdSchema = z.string().brand<"ProductId">();
export type ProductId = z.infer<typeof productIdSchema>;

export const sellerIdSchema = z.string().brand<"SellerId">();
export type SellerId = z.infer<typeof sellerIdSchema>;
