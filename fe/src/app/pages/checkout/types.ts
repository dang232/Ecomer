import type { TFunction } from "i18next";
import {
  Banknote,
  CheckCircle,
  CreditCard,
  MapPin,
  QrCode,
  Truck,
  Wallet,
} from "lucide-react";

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
  id: "VNPAY" | "MOMO" | "COD" | "BANK" | "STRIPE" | "PAYPAL" | "VIETQR";
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
      fee: 30000,
      eta: t("checkout.shipping.fallbackStandard.eta"),
    },
    {
      id: "EXPRESS",
      name: t("checkout.shipping.expressName"),
      desc: t("checkout.shipping.fallbackEconomy.desc"),
      fee: 45000,
      eta: t("checkout.shipping.fallbackEconomy.eta"),
    },
  ];
}

/** Raw shape returned by the payment-methods API endpoint. */
export interface RawPaymentMethod {
  code: string;
  name: string;
  description?: string;
  enabled?: boolean;
}

/**
 * Map raw API payment methods to PaymentOption[].
 * Warns on unknown codes and falls back to a generic CreditCard icon.
 * Extracted for testability (was inline useMemo in CheckoutPage).
 */
export function mapPaymentOptions(
  data: RawPaymentMethod[] | undefined,
  t: TFunction,
): PaymentOption[] {
  const fallback = makeFallbackPayment(t);
  if (!data || data.length === 0) return fallback;
  const codeToFallback: Record<string, PaymentOption> = {
    VNPAY: fallback[0],
    MOMO: fallback[1],
    VIETQR: fallback[2],
    STRIPE: fallback[3],
    PAYPAL: fallback[4],
    BANK: fallback[5],
    COD: fallback[6],
  };
  return data
    .filter((p) => p.enabled !== false)
    .map((p) => {
      const mapped = codeToFallback[p.code];
      if (!mapped) {
        console.warn(
          `[CheckoutPage] Unknown payment code "${p.code}" — using generic CreditCard icon. Consider adding it to codeToFallback.`,
        );
      }
      return mapped ?? {
        id: p.code as PaymentOption["id"],
        name: p.name,
        Icon: CreditCard,
        desc: p.description ?? "",
      };
    });
}

export function makeFallbackPayment(t: TFunction): PaymentOption[] {
  return [
    { id: "VNPAY", name: "VNPay", Icon: Wallet, desc: t("checkout.payment.vnpayDesc") },
    { id: "MOMO", name: "MoMo", Icon: Wallet, desc: t("checkout.payment.momoDesc") },
    { id: "VIETQR", name: "VietQR", Icon: QrCode, desc: t("checkout.payment.vietqrDesc") },
    {
      id: "STRIPE",
      name: t("checkout.payment.stripeName"),
      Icon: CreditCard,
      desc: "Visa, Mastercard, Amex via Stripe",
    },
    { id: "PAYPAL", name: "PayPal", Icon: Wallet, desc: t("checkout.payment.paypalDesc") },
    { id: "BANK", name: t("checkout.payment.bankName"), Icon: CreditCard, desc: "Visa, Mastercard, JCB" },
    { id: "COD", name: t("checkout.payment.codName"), Icon: Banknote, desc: t("checkout.payment.codDesc") },
  ];
}

