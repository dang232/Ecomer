import { LogIn, Tag } from "lucide-react";
import { useTranslation } from "react-i18next";

import { formatPrice } from "@/shared/lib";
import { Button } from "@/shared/ui";

interface CartSummaryProps {
  itemCount: number;
  subtotalVnd: number;
  shippingFeeVnd: number;
  couponDiscountVnd: number;
  coupon: string;
  appliedCoupon: string | null;
  couponError?: string;
  couponPending?: boolean;
  authenticated: boolean;
  onCouponChange: (value: string) => void;
  onApplyCoupon: () => void;
  onRemoveCoupon: () => void;
  onLogin: () => void;
  onCheckout: () => void;
}

export function CartSummary({
  itemCount,
  subtotalVnd,
  shippingFeeVnd,
  couponDiscountVnd,
  coupon,
  appliedCoupon,
  couponError,
  couponPending = false,
  authenticated,
  onCouponChange,
  onApplyCoupon,
  onRemoveCoupon,
  onLogin,
  onCheckout,
}: CartSummaryProps) {
  const { t } = useTranslation();
  const totalVnd = subtotalVnd;

  return (
    <section
      aria-label={t("cart.summaryTitle")}
      className="rounded-[var(--radius-card)] border border-border bg-card p-4 sm:p-5"
    >
      <h2 className="text-base font-bold text-foreground">{t("cart.summaryTitle")}</h2>
      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{t("cart.subtotal", { count: itemCount })}</dt>
          <dd className="font-medium text-foreground">{formatPrice(subtotalVnd)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{t("cart.shippingFee")}</dt>
          <dd
            className={
              shippingFeeVnd === 0 ? "font-medium text-success" : "font-medium text-foreground"
            }
          >
            {shippingFeeVnd === 0 ? t("cart.free") : formatPrice(shippingFeeVnd)}
          </dd>
        </div>
        {couponDiscountVnd > 0 ? (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t("cart.voucherDiscount")}</dt>
            <dd className="font-medium text-success">-{formatPrice(couponDiscountVnd)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-3 border-t border-border pt-3 text-base font-bold">
          <dt>{t("cart.merchandiseTotal")}</dt>
          <dd className="text-primary">{formatPrice(totalVnd)}</dd>
        </div>
      </dl>

      <div className="mt-5">
        {appliedCoupon ? (
          <div className="flex items-center justify-between gap-2 rounded-[var(--radius-control)] bg-success-light px-3 py-2 text-sm text-success">
            <span className="min-w-0 truncate">
              {t("cart.couponApplied", { code: appliedCoupon })}
            </span>
            <button
              type="button"
              onClick={onRemoveCoupon}
              className="shrink-0 font-semibold hover:underline"
            >
              {t("cart.couponRemove")}
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="cart-coupon">
              {t("cart.couponHeader")}
            </label>
            <input
              id="cart-coupon"
              value={coupon}
              onChange={(event) => onCouponChange(event.target.value.toUpperCase())}
              onKeyDown={(event) => event.key === "Enter" && onApplyCoupon()}
              placeholder={t("cart.couponPlaceholder")}
              className="min-w-0 flex-1 rounded-[var(--radius-control)] border border-border bg-background px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!coupon.trim()}
              pending={couponPending}
              onClick={onApplyCoupon}
            >
              <Tag className="h-4 w-4" />
              {t("cart.couponApply")}
            </Button>
          </div>
        )}
        {couponError ? (
          <p role="alert" className="mt-2 text-xs text-error">
            {couponError}
          </p>
        ) : null}
      </div>

      {!authenticated ? (
        <button
          type="button"
          onClick={onLogin}
          className="mt-4 flex w-full items-center gap-2 rounded-[var(--radius-control)] bg-primary-light p-3 text-left text-sm font-medium text-primary"
        >
          <LogIn className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t("cart.guestBanner")}
        </button>
      ) : null}
      <Button className="mt-4 w-full" size="lg" onClick={onCheckout}>
        {t("cart.proceedCheckout")}
      </Button>
    </section>
  );
}
