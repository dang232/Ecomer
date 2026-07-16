import { z } from "zod";

import {
  calculateCheckoutSchema,
  paymentMethodSchema,
  shippingOptionSchema,
  validateCouponResponseSchema,
  type CheckoutCalculation,
} from "../../../types/api";
import { api } from "../client";

export type { CheckoutCalculation };
export { calculateCheckoutSchema };

export interface CheckoutCalculateInput {
  /**
   * Light shape — server resolves authoritative price from product-service.
   * Mirrors the {@code POST /orders} contract: client never sends price.
   */
  items: { productId: string; variantSku?: string; quantity: number }[];
  couponCode?: string;
}

export const calculateCheckout = (body: CheckoutCalculateInput) =>
  api.post("/checkout/calculate", calculateCheckoutSchema, body);

export const paymentMethods = () =>
  api.get("/checkout/payment-methods", z.array(paymentMethodSchema));

export const shippingOptions = (body: {
  items: { productId: string; quantity: number }[];
  addressId?: number;
}) => api.post("/checkout/shipping-options", z.array(shippingOptionSchema), body);

export const validateCoupon = (body: { code: string; subtotal?: number }) =>
  api.post("/checkout/validate-coupon", validateCouponResponseSchema, body);

// Shipping rates from shipping-service (zone+weight based)
export interface ShippingRatesRequest {
  street: string;
  ward?: string;
  district: string;
  province: string;
  orderTotalVnd: number;
}

const shippingRatesResponseSchema = z.object({
  options: z.array(
    z.object({
      serviceCode: z.string(),
      feeVnd: z.number(),
      estimatedDeliveryTime: z.string(),
    }),
  ),
});

export const fetchShippingRates = (body: ShippingRatesRequest) =>
  api.post("/shipping/rates", shippingRatesResponseSchema, body);
