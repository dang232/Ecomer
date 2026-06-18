import { CreditCard, MapPin, Package, Truck } from "lucide-react";
import { useTranslation } from "react-i18next";

import { formatPrice } from "../../lib/format";
import type { Address, CartItem } from "../../types/api";

import { formatAddressLine } from "./format";
import type { PaymentOption, ShippingOption } from "./types";

interface Props {
  addresses: Address[];
  selectedAddressIndex: number;
  shipping: ShippingOption | undefined;
  paymentOptions: PaymentOption[];
  selectedPaymentId: PaymentOption["id"];
  cartItems: CartItem[];
  buyerName: string;
  isProcessing: boolean;
  setStep: (step: "address" | "shipping" | "payment") => void;
}

export function CheckoutReviewStep({
  addresses,
  selectedAddressIndex,
  shipping,
  paymentOptions,
  selectedPaymentId,
  cartItems,
  buyerName,
  isProcessing,
  setStep,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <h2 className="font-bold text-foreground text-lg mb-4">{t("checkout.review.header")}</h2>

      {/* Address */}
      <div className="p-3.5 border border-border rounded-[var(--radius-lg)] bg-background">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <MapPin size={14} className="text-primary" />
            {t("checkout.review.shippingAddress")}
          </h3>
          <button
            onClick={() => setStep("address")}
            disabled={isProcessing}
            className="text-xs text-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t("checkout.review.change")}
          </button>
        </div>
        {addresses[selectedAddressIndex] ? (
          <div className="text-sm">
            <p className="font-semibold text-foreground">
              {buyerName}
              {addresses[selectedAddressIndex].phone ? (
                <> · {addresses[selectedAddressIndex].phone}</>
              ) : null}
            </p>
            <p className="text-muted-foreground text-xs mt-0.5">
              {formatAddressLine(addresses[selectedAddressIndex])}
            </p>
          </div>
        ) : (
          <p className="text-sm text-red-600 dark:text-red-400">{t("checkout.review.noAddress")}</p>
        )}
      </div>

      {/* Shipping */}
      <div className="p-3.5 border border-border rounded-[var(--radius-lg)] bg-background">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Truck size={14} className="text-primary" />
            {t("checkout.review.shippingMethod")}
          </h3>
          <button
            onClick={() => setStep("shipping")}
            disabled={isProcessing}
            className="text-xs text-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t("checkout.review.change")}
          </button>
        </div>
        <p className="text-sm font-medium text-foreground">{shipping?.name}</p>
        <p className="text-xs text-muted-foreground">
          {t("checkout.shipping.etaPrefix", { eta: shipping?.eta ?? "" })}
        </p>
      </div>

      {/* Payment */}
      <div className="p-3.5 border border-border rounded-[var(--radius-lg)] bg-background">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <CreditCard size={14} className="text-primary" />
            {t("checkout.review.paymentMethod")}
          </h3>
          <button
            onClick={() => setStep("payment")}
            disabled={isProcessing}
            className="text-xs text-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t("checkout.review.change")}
          </button>
        </div>
        <p className="text-sm font-medium text-foreground">
          {paymentOptions.find((p) => p.id === selectedPaymentId)?.name}
        </p>
      </div>

      {/* Items */}
      <div className="p-3.5 border border-border rounded-[var(--radius-lg)] bg-background">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-3">
          <Package size={14} className="text-primary" />
          {t("checkout.review.productsCount", { count: cartItems.length })}
        </h3>
        <div className="space-y-3">
          {cartItems.map((item) => {
            // These fields may arrive from the cart API (P2-3 audit)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const extra = item as any;
            const variant = extra.variant as string | undefined;
            const sellerName = extra.sellerName as string | undefined;
            const stock = extra.stock as number | undefined;
            const isLowStock = stock !== undefined && stock < item.quantity;
            return (
              <div key={item.productId} className="flex items-center gap-3">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name ?? ""}
                    className="w-14 h-14 rounded-lg object-cover shrink-0"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-muted shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {item.name ?? item.productId}
                  </p>
                  {variant ? (
                    <p className="text-xs text-muted-foreground truncate">{variant}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {sellerName ?? t("checkout.review.sellerFallback", { defaultValue: "Unknown seller" })}
                  </p>
                  {isLowStock ? (
                    <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
                      {t("checkout.review.lowStock", { count: stock, defaultValue: `Low stock — only ${stock} left` })}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">x{item.quantity}</p>
                </div>
                <span className="text-sm font-bold text-primary shrink-0">
                  {formatPrice(item.price * item.quantity)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
