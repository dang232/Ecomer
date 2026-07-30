import { Clock, Loader2, Package, Truck, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";

import { FREE_SHIPPING_THRESHOLD } from "@/shared/contracts";
import { formatPrice } from "@/shared/lib";

import type { ShippingOption } from "./types";

interface Props {
  shippingOptions: ShippingOption[];
  selectedShippingId: string;
  setShippingChoice: (id: string) => void;
  note: string;
  setNote: (note: string) => void;
  isLoadingRates?: boolean;
  subtotal?: number;
}

const SHIPPING_ICONS: Record<string, typeof Truck> = {
  EXPRESS: Zap,
  STANDARD: Truck,
  ECONOMY: Package,
};

function getShippingIcon(id: string): typeof Truck {
  return SHIPPING_ICONS[id.toUpperCase()] ?? Truck;
}

export function CheckoutShippingStep({
  shippingOptions,
  selectedShippingId,
  setShippingChoice,
  note,
  setNote,
  isLoadingRates = false,
  subtotal = 0,
}: Props) {
  const { t } = useTranslation();
  const freeShipping = subtotal > FREE_SHIPPING_THRESHOLD;

  return (
    <div>
      <h2 className="font-bold text-foreground text-lg mb-4">{t("checkout.shipping.header")}</h2>

      {freeShipping ? (
        <div className="mb-4 px-4 py-3 rounded-[var(--radius-lg)] text-sm font-medium flex items-center gap-2 bg-primary-light text-primary">
          <Truck size={16} />
          {t("checkout.shipping.freeShippingBanner")}
        </div>
      ) : (
        <p className="mb-4 text-xs text-muted-foreground">
          {t("checkout.shipping.remainingForFreeShipping", {
            amount: formatPrice(Math.max(FREE_SHIPPING_THRESHOLD - subtotal, 0)),
          })}
        </p>
      )}

      {isLoadingRates ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" />
          {t("checkout.shipping.loadingRates")}
        </div>
      ) : (
        <div role="radiogroup" aria-label="Shipping method" className="space-y-3">
          {shippingOptions.map((method) => {
            const isSelected = selectedShippingId === method.id;
            const ShipIcon = getShippingIcon(method.id);
            const inputId = `checkout-shipping-${method.id}`;
            return (
              <label
                key={method.id}
                htmlFor={inputId}
                className={[
                  "w-full flex items-center gap-4 p-4 border-[1.5px] rounded-[var(--radius-lg)] cursor-pointer transition-all text-left",
                  "peer-focus-within:ring-2 peer-focus-within:ring-primary peer-focus-within:ring-offset-2",
                  isSelected
                    ? "border-primary bg-[var(--primary-subtle)] shadow-[0_0_0_3px_oklch(from_var(--primary)_l_c_h_/_0.08)]"
                    : "border-border hover:border-border-hover hover:shadow-sm",
                ].join(" ")}
              >
                <input
                  id={inputId}
                  type="radio"
                  name="checkout-shipping"
                  value={method.id}
                  checked={isSelected}
                  onChange={() => setShippingChoice(method.id)}
                  className="peer sr-only"
                />
                {/* Icon box */}
                <span className="w-10 h-10 rounded-md bg-surface-elevated flex items-center justify-center shrink-0">
                  <ShipIcon
                    size={20}
                    className={isSelected ? "text-primary" : "text-muted-foreground"}
                  />
                </span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">{method.name}</p>
                  <p className="text-xs text-muted-foreground">{method.desc}</p>
                  <p className="text-xs text-success flex items-center gap-1 mt-0.5">
                    <Clock size={11} />
                    {t("checkout.shipping.etaPrefix", { eta: method.eta })}
                  </p>
                </div>

                {/* Price */}
                <div className="text-right shrink-0">
                  <p
                    className={[
                      "font-bold text-sm",
                      method.fee === 0 ? "text-success" : "text-foreground",
                    ].join(" ")}
                  >
                    {method.fee === 0 ? t("checkout.shipping.free") : formatPrice(method.fee)}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      )}

      <div className="mt-5">
        <label htmlFor="checkout-note" className="block text-sm font-semibold text-foreground mb-2">
          {t("checkout.shipping.noteLabel")}
        </label>
        <textarea
          id="checkout-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder={t("checkout.shipping.notePlaceholder")}
          className="w-full px-4 py-3 border border-border rounded-[var(--radius-lg)] text-sm outline-none focus:border-primary resize-none bg-card transition-colors"
        />
      </div>
    </div>
  );
}
