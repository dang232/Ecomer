import { z } from "zod";

export const initiatePaymentSchema = z
  .object({
    orderId: z.string(),
    redirectUrl: z.string().url().nullable(),
    transactionId: z.string().optional(),
  })
  .passthrough();

/** Wire values emitted by payment-service PaymentStatus.name() */
export const PAYMENT_STATUS_VALUES = ["PENDING", "COMPLETED", "FAILED"] as const;
/** Wire values emitted by payment-service PaymentMethod.name() */
export const PAYMENT_METHOD_VALUES = [
  "COD",
  "VNPAY",
  "MOMO",
  "VIETQR",
  "STRIPE",
  "PAYPAL",
] as const;

export const paymentStatusSchema = z
  .object({
    orderId: z.string(),
    paymentId: z.string().optional(),
    status: z.enum(PAYMENT_STATUS_VALUES),
    paidAt: z.string().nullable().optional(),
    method: z.enum(PAYMENT_METHOD_VALUES).optional(),
  })
  .passthrough();
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
