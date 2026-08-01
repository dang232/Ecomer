import { z } from "zod";

import { initiatePaymentSchema, paymentStatusSchema, type PaymentStatus } from "../../../types/api";
import { api } from "../client";

export type { PaymentStatus };

export const codConfirm = (body: { orderId: string }, idempotencyKey?: string) =>
  api.post("/payment/cod/confirm", paymentStatusSchema, body, { idempotencyKey });

export const vnpayCreate = (
  body: { orderId: string; returnUrl?: string },
  idempotencyKey?: string,
) => api.post("/payment/vnpay/create", initiatePaymentSchema, body, { idempotencyKey });

export const momoCreate = (
  body: { orderId: string; returnUrl?: string },
  idempotencyKey?: string,
) => api.post("/payment/momo/create", initiatePaymentSchema, body, { idempotencyKey });

export const paymentStatus = (orderId: string) =>
  api.get(`/payment/status/${encodeURIComponent(orderId)}`, paymentStatusSchema);

const stripeCreateSchema = z.object({
  payment: paymentStatusSchema,
  publishableKey: z.string(),
  clientSecret: z.string(),
  intentId: z.string(),
  externalAmount: z.union([z.number(), z.string()]).optional(),
  externalCurrency: z.string().optional(),
  fxRate: z.union([z.number(), z.string()]).optional(),
});

const payPalCreateSchema = z.object({
  payment: paymentStatusSchema,
  clientId: z.string(),
  paypalOrderId: z.string(),
  status: z.string(),
  externalAmount: z.union([z.number(), z.string()]).optional(),
  externalCurrency: z.string().optional(),
  fxRate: z.union([z.number(), z.string()]).optional(),
});

const vietQrCreateSchema = z.object({
  payment: paymentStatusSchema,
  qrImageUrl: z.string(),
  bankBin: z.string(),
  accountNo: z.string(),
  accountName: z.string(),
  reference: z.string(),
});

export const stripeCreate = (body: { orderId: string }, idempotencyKey?: string) =>
  api.post("/payment/stripe/create", stripeCreateSchema, body, { idempotencyKey });

export const paypalCreate = (body: { orderId: string }, idempotencyKey?: string) =>
  api.post("/payment/paypal/create", payPalCreateSchema, body, { idempotencyKey });

export const paypalCapture = (paymentId: string, paypalOrderId: string) =>
  api.post(
    `/payment/paypal/capture/${encodeURIComponent(paymentId)}/${encodeURIComponent(paypalOrderId)}`,
    z.object({ payment: paymentStatusSchema }),
    {},
  );

export const vietqrCreate = (body: { orderId: string }, idempotencyKey?: string) =>
  api.post("/payment/vietqr/create", vietQrCreateSchema, body, { idempotencyKey });
