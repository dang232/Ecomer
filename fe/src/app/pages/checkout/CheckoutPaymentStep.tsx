import { ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { PaymentOption } from "./types";

interface Props {
  paymentOptions: PaymentOption[];
  selectedPaymentId: PaymentOption["id"];
  setSelectedPaymentId: (id: PaymentOption["id"]) => void;
  loadError?: Error | null;
  onRetry?: () => void;
}

export function CheckoutPaymentStep({
  paymentOptions,
  selectedPaymentId,
  setSelectedPaymentId,
  loadError,
  onRetry,
}: Props) {
  const { t } = useTranslation();

  return (
    <div>
      <h2 className="font-bold text-foreground text-lg mb-4">{t("checkout.payment.header")}</h2>
      {loadError || paymentOptions.length === 0 ? (
        <div role="alert" className="border border-destructive/40 bg-destructive/5 p-4 text-sm text-foreground">
          <p>{t("checkout.payment.unavailable")}</p>
          {onRetry ? (
            <button type="button" onClick={onRetry} className="mt-2 text-sm font-semibold text-primary">
              {t("checkout.payment.retry")}
            </button>
          ) : null}
        </div>
      ) : null}
      <div role="radiogroup" aria-label="Payment method" className="space-y-3">
        {paymentOptions.map((method) => {
          const isSelected = selectedPaymentId === method.id;
          const inputId = `checkout-payment-${method.id}`;
          return (
            <label
              key={method.id}
              htmlFor={inputId}
              className={[
                "w-full flex items-center gap-3.5 px-4 py-3.5 border-[1.5px] rounded-[var(--radius-lg)] cursor-pointer transition-all text-left",
                "peer-focus-within:ring-2 peer-focus-within:ring-primary peer-focus-within:ring-offset-2",
                isSelected
                  ? "border-primary bg-[var(--primary-subtle)] shadow-[0_0_0_3px_oklch(from_var(--primary)_l_c_h_/_0.08)]"
                  : "border-border hover:border-border-hover hover:shadow-sm",
              ].join(" ")}
            >
              <input
                id={inputId}
                type="radio"
                name="checkout-payment"
                value={method.id}
                checked={isSelected}
                onChange={() => setSelectedPaymentId(method.id)}
                className="peer sr-only"
              />
              {/* Icon box */}
              <span className="w-9 h-9 rounded-md bg-surface-elevated flex items-center justify-center shrink-0">
                <method.Icon
                  size={18}
                  className={isSelected ? "text-primary" : "text-muted-foreground"}
                />
              </span>

              {/* Name + desc */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground">{method.name}</p>
                <p className="text-[11px] text-muted-foreground">{method.desc}</p>
              </div>

              {/* Radio dot */}
              <div
                className={[
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                  isSelected ? "border-primary" : "border-border",
                ].join(" ")}
              >
                {isSelected ? <div className="w-2.5 h-2.5 rounded-full bg-primary" /> : null}
              </div>
            </label>
          );
        })}
      </div>

      {/* Security note */}
      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground p-3 bg-background rounded-[var(--radius-md)] border border-border">
        <ShieldCheck size={14} className="text-success shrink-0" />
        <span>{t("checkout.payment.sslNotice")}</span>
      </div>
    </div>
  );
}
