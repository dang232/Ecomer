import { z } from "zod";

import type { PlaceOrderInput } from "@/shared/api/endpoints/orders";
import { checkoutProviderSchema } from "@/shared/contracts/api";

import type { PurchasedCartItem } from "./cart-cleanup";

const purchasedCartItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  quantity: z.number().int().positive(),
});

const recoveryOrderSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().min(1),
      variantSku: z.string().optional(),
      quantity: z.number().int().positive(),
    }),
  ),
  shippingAddress: z.object({
    street: z.string().min(1),
    ward: z.string().optional(),
    district: z.string().min(1),
    city: z.string().min(1),
  }),
  shippingDetails: z.object({
    recipientName: z.string().min(1),
    recipientPhone: z.string().min(1),
    wardCode: z.string().min(1),
    districtCode: z.string().min(1),
    provinceCode: z.string().min(1),
  }),
  paymentMethod: checkoutProviderSchema.optional(),
  couponCode: z.string().optional(),
  notes: z.string().optional(),
});

const baseSchema = z.object({
  version: z.literal(1),
  orderKey: z.string().uuid(),
  cartFingerprint: z.string(),
  provider: checkoutProviderSchema,
  purchasedItems: z.array(purchasedCartItemSchema).default([]),
});

export const checkoutRecoverySchema = z.discriminatedUnion("phase", [
  baseSchema.extend({
    phase: z.literal("order"),
    order: recoveryOrderSchema,
    reconciliationAttempts: z.number().int().nonnegative().default(0),
    reconciliationDeadline: z.number().finite(),
  }),
  baseSchema.extend({
    phase: z.literal("created"),
    paymentKey: z.string().uuid(),
    orderId: z.string().min(1),
    total: z.number().nonnegative(),
  }),
  baseSchema.extend({
    phase: z.literal("redirect"),
    paymentKey: z.string().uuid(),
    orderId: z.string().min(1),
    paymentId: z.string().uuid(),
    total: z.number().nonnegative(),
    provider: z.enum(["VNPAY", "MOMO"]),
  }),
  baseSchema.extend({
    phase: z.literal("vietqr"),
    paymentKey: z.string().uuid(),
    orderId: z.string().min(1),
    paymentId: z.string().uuid(),
    total: z.number().nonnegative(),
    qrImageUrl: z.string().url(),
    reference: z.string().min(1),
  }),
  baseSchema.extend({
    phase: z.literal("stripe"),
    paymentKey: z.string().uuid(),
    orderId: z.string().min(1),
    paymentId: z.string().uuid(),
    total: z.number().nonnegative(),
    intentId: z.string().min(1),
    publishableKey: z.string().min(1),
  }),
  baseSchema.extend({
    phase: z.literal("paypal"),
    paymentKey: z.string().uuid(),
    orderId: z.string().min(1),
    paymentId: z.string().uuid(),
    total: z.number().nonnegative(),
    clientId: z.string().min(1),
    paypalOrderId: z.string().min(1),
  }),
]);

export type CheckoutRecoveryRecord = z.infer<typeof checkoutRecoverySchema>;
export const CHECKOUT_RECOVERY_STORAGE_KEY = "vnshop:checkout-recovery";

export interface CheckoutRecoveryStore {
  read(): CheckoutRecoveryRecord | null;
  write(record: CheckoutRecoveryRecord): void;
  clear(): void;
}

export function createCheckoutRecoveryStore(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
): CheckoutRecoveryStore {
  return {
    read() {
      const raw = storage.getItem(CHECKOUT_RECOVERY_STORAGE_KEY);
      if (!raw) return null;
      try {
        const parsed = checkoutRecoverySchema.safeParse(JSON.parse(raw));
        if (parsed.success) return parsed.data;
      } catch {
        // The corrupt record is discarded below.
      }
      storage.removeItem(CHECKOUT_RECOVERY_STORAGE_KEY);
      return null;
    },
    write(record) {
      storage.setItem(
        CHECKOUT_RECOVERY_STORAGE_KEY,
        JSON.stringify(checkoutRecoverySchema.parse(record)),
      );
    },
    clear() {
      storage.removeItem(CHECKOUT_RECOVERY_STORAGE_KEY);
    },
  };
}

export type RecoveryOrderInput = z.infer<typeof recoveryOrderSchema>;
export type { PurchasedCartItem };
export type { PlaceOrderInput };
