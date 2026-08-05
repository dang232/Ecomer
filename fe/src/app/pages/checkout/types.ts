import type { TFunction } from "i18next";
import { Banknote, CheckCircle, CreditCard, MapPin, QrCode, Truck, Wallet } from "lucide-react";

import {
  CHECKOUT_IMPLEMENTED_METHODS,
  checkoutProviderSchema,
  type CheckoutProvider,
  type PaymentMethodOption,
} from "@/shared/contracts/api";

export type Step = "address" | "shipping" | "payment" | "review" | "success";

export interface CheckoutStepConfig {
  id: Step;
  labelKey: string;
  icon: typeof MapPin;
}

export interface ShippingOption {
  id: string;
  name: string;
  desc: string;
  fee: number;
  eta: string;
}

export interface PaymentOption {
  id: CheckoutProvider;
  name: string;
  Icon: typeof CreditCard;
  desc: string;
}

export const STEPS: CheckoutStepConfig[] = [
  { id: "address", labelKey: "checkout.steps.address", icon: MapPin },
  { id: "shipping", labelKey: "checkout.steps.shipping", icon: Truck },
  { id: "payment", labelKey: "checkout.steps.payment", icon: CreditCard },
  { id: "review", labelKey: "checkout.steps.review", icon: CheckCircle },
];

export function makeFallbackShipping(t: TFunction): ShippingOption[] {
  return [
    {
      id: "STANDARD",
      name: t("checkout.shipping.standardName"),
      desc: t("checkout.shipping.fallbackStandard.desc"),
      fee: 0,
      eta: t("checkout.shipping.fallbackStandard.eta"),
    },
  ];
}

const warnedUnsupportedProviders = new Set<string>();

/** Returns the enabled server capabilities that checkout implements. */
export function toPaymentOptions(
  data: PaymentMethodOption[] | undefined,
  t: TFunction,
): PaymentOption[] {
  if (!data || data.length === 0) return [];
  const options: Record<CheckoutProvider, PaymentOption> = {
    COD: {
      id: "COD",
      name: t("checkout.payment.codName"),
      Icon: Banknote,
      desc: t("checkout.payment.codDesc"),
    },
    VNPAY: { id: "VNPAY", name: "VNPay", Icon: Wallet, desc: t("checkout.payment.vnpayDesc") },
    MOMO: { id: "MOMO", name: "MoMo", Icon: Wallet, desc: t("checkout.payment.momoDesc") },
    VIETQR: { id: "VIETQR", name: "VietQR", Icon: QrCode, desc: t("checkout.payment.vietqrDesc") },
    STRIPE: {
      id: "STRIPE",
      name: t("checkout.payment.stripeName"),
      Icon: CreditCard,
      desc: "Visa, Mastercard, Amex via Stripe",
    },
    PAYPAL: { id: "PAYPAL", name: "PayPal", Icon: Wallet, desc: t("checkout.payment.paypalDesc") },
  };

  return data
    .filter((payment) => payment.enabled !== false)
    .flatMap((payment) => {
      const provider = payment.id.toUpperCase();
      const parsed = checkoutProviderSchema.safeParse(provider);
      if (!parsed.success || !CHECKOUT_IMPLEMENTED_METHODS.includes(parsed.data)) {
        if (import.meta.env.DEV && !warnedUnsupportedProviders.has(provider)) {
          warnedUnsupportedProviders.add(provider);
          console.warn(`[CheckoutPage] Unsupported checkout provider "${provider}" was omitted.`);
        }
        return [];
      }
      return [options[parsed.data]];
    });
}

export const mapPaymentOptions = toPaymentOptions;
