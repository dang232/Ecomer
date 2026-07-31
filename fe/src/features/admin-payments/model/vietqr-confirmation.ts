import { z } from "zod";

/**
 * Plan 06 Task 4 — admin-side VietQR manual confirmation.
 *
 * The BE controller (`payment-service/AdminVietQrController`) only takes a
 * payment id path variable plus an OPTIONAL trimmed `bankReference` body —
 * no amount, no note. The merchant sees the bank credit notification and
 * records it back so the order can transition out of `pending_payment`.
 * Amount lives on the payment itself; the panel only confirms it.
 */

export const vietqrConfirmationSchema = z.object({
  paymentId: z.string().uuid("Payment id must be a UUID"),
  bankReference: z
    .string()
    .trim()
    .max(120, "Bank reference is too long")
    .optional(),
});

export type VietqrConfirmationInput = z.infer<typeof vietqrConfirmationSchema>;

export interface VietqrConfirmationParsed {
  paymentId: string;
  bankReference?: string;
}

export function parseVietqrConfirmation(
  raw: { paymentId: string; bankReference?: string },
): VietqrConfirmationParsed {
  return vietqrConfirmationSchema.parse(raw);
}

export function buildVietqrConfirmationPayload(
  bankReference: string | undefined,
): { bankReference?: string } {
  const trimmed = bankReference?.trim();
  return trimmed ? { bankReference: trimmed } : {};
}
