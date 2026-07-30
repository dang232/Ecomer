import { z } from "zod";

/** Wire values emitted by payment-service PaymentStatus.name() */
export const PAYMENT_STATUS_VALUES = [
  "PENDING",
  "AWAITING_COLLECTION",
  "COMPLETED",
  "FAILED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
  "PAYMENT_TIMEOUT",
] as const;
/** Wire values emitted by payment-service PaymentMethod.name() */
export const PAYMENT_METHOD_VALUES = [
  "COD",
  "VNPAY",
  "MOMO",
  "VIETQR",
  "STRIPE",
  "PAYPAL",
] as const;

export const paymentResponseSchema = z
  .object({
    paymentId: z.string().min(1),
    orderId: z.string().min(1),
    amount: z.number(),
    method: z.enum(PAYMENT_METHOD_VALUES),
    status: z.enum(PAYMENT_STATUS_VALUES),
    transactionRef: z.string().nullable(),
    redirectUrl: z.string().url().nullable(),
    createdAt: z.string().nullable().optional(),
    externalAmount: z.number().nullable().optional(),
    externalCurrency: z.string().nullable().optional(),
    fxRate: z.number().nullable().optional(),
    fxRateAt: z.string().nullable().optional(),
  })
  .passthrough();
export const paymentStatusSchema = paymentResponseSchema;
export type PaymentStatus = z.infer<typeof paymentResponseSchema>;
