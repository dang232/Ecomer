import { Check, CheckCircle, ChevronRight, Tag } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";

import { ApiError } from "@/shared/api";
import type { BuyerCoupon } from "@/shared/contracts/api";
import { formatPrice } from "@/shared/lib";

import type { Step } from "./types";

interface Props {
  cartItems: { productId: string; name?: string | null; price: number; quantity: number }[];
  subtotal: number;
  shippingFee: number;
  discount: number;
  finalTotal: number;
  step: Step;
  isProcessing: boolean;
  canSubmit: boolean;
  addresses: { length: number };
  appliedCoupon: string | null;
  couponInput: string;
  setCouponInput: (v: string) => void;
  showCouponPicker: boolean;
  setShowCouponPicker: (fn: (v: boolean) => boolean) => void;
  couponsQuery: {
    isLoading: boolean;
    error: unknown;
    data?: BuyerCoupon[];
  };
  couponMutation: {
    isPending: boolean;
  };
  handleApplyCoupon: () => void;
  handlePickCoupon: (code: string) => void;
  handleRemoveCoupon: () => void;
  handleNext: () => void;
}

export function CheckoutSummary({
  cartItems,
  subtotal,
  shippingFee,
  discount,
  finalTotal,
  step,
  isProcessing,
  canSubmit,
  addresses,
  appliedCoupon,
  couponInput,
  setCouponInput,
  showCouponPicker,
  setShowCouponPicker,
  couponsQuery,
  couponMutation,
  handleApplyCoupon,
  handlePickCoupon,
  handleRemoveCoupon,
  handleNext,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="sticky top-[80px] h-fit">
      <div className="bg-card border border-border rounded-[var(--radius-xl)] p-6 space-y-4">
        <h3 className="font-bold text-foreground">{t("checkout.summary.title")}</h3>

        {/* Item list */}
        <div className="space-y-2 text-sm">
          {cartItems.slice(0, 3).map((item) => (
            <div key={item.productId} className="flex justify-between gap-2">
              <span className="text-muted-foreground truncate">
                {(item.name ?? item.productId).split(" ").slice(0, 4).join(" ")}... x{item.quantity}
              </span>
              <span className="font-medium shrink-0">
                {formatPrice(item.price * item.quantity)}
              </span>
            </div>
          ))}
          {cartItems.length > 3 ? (
            <p className="text-xs text-muted-foreground">
              {t("checkout.summary.moreItems", { count: cartItems.length - 3 })}
            </p>
          ) : null}
        </div>

        {/* Coupon */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="checkout-coupon-input"
              className="block text-xs font-semibold text-muted-foreground"
            >
              {t("checkout.summary.couponLabel")}
            </label>
            {!appliedCoupon ? (
              <button
                onClick={() => setShowCouponPicker((v) => !v)}
                className="flex items-center gap-1 text-xs font-semibold text-primary transition-colors"
                type="button"
              >
                <Tag size={12} />
                {showCouponPicker
                  ? t("checkout.summary.togglePickerHide")
                  : t("checkout.summary.togglePicker")}
              </button>
            ) : null}
          </div>

          <AnimatePresence>
            {showCouponPicker && !appliedCoupon ? (
              <motion.div
                key="picker"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden mb-3"
              >
                <div className="rounded-[var(--radius-lg)] border border-border bg-muted/50 p-2 max-h-48 overflow-y-auto">
                  {couponsQuery.isLoading ? (
                    <p className="text-xs text-muted-foreground px-2 py-1">
                      {t("checkout.summary.couponLoading")}
                    </p>
                  ) : null}
                  {couponsQuery.error instanceof ApiError ? (
                    <p className="text-xs text-red-600 dark:text-red-400 px-2 py-1">
                      {t("checkout.summary.couponLoadFail", {
                        message: couponsQuery.error.message,
                      })}
                    </p>
                  ) : null}
                  {couponsQuery.data?.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-2 py-2 text-center">
                      {t("checkout.summary.couponEmpty")}
                    </p>
                  ) : null}
                  {couponsQuery.data && couponsQuery.data.length > 0 ? (
                    <ul className="space-y-1">
                      {couponsQuery.data.map((coupon) => {
                        const value = coupon.value ?? coupon.discountValue;
                        const type = (coupon.type ?? coupon.discountType ?? "FIXED").toUpperCase();
                        const label =
                          type === "PERCENT" && value !== undefined
                            ? t("checkout.summary.couponDiscountPct", { value })
                            : value !== undefined
                              ? t("checkout.summary.couponDiscountAmount", {
                                  value: formatPrice(value),
                                })
                              : t("checkout.summary.couponDiscountFallback");
                        const minLabel = coupon.minOrderValue
                          ? t("checkout.summary.couponMinOrder", {
                              value: formatPrice(coupon.minOrderValue),
                            })
                          : null;
                        const eligible = !coupon.minOrderValue || subtotal >= coupon.minOrderValue;
                        return (
                          <li key={coupon.code}>
                            <button
                              onClick={() => handlePickCoupon(coupon.code)}
                              disabled={!eligible}
                              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left rounded-[var(--radius-lg)] bg-card border border-border hover:border-primary hover:shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:shadow-none"
                              type="button"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-bold font-mono truncate text-primary">
                                  {coupon.code}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {label}
                                  {minLabel ? ` · ${minLabel}` : ""}
                                </p>
                              </div>
                              <span
                                className={[
                                  "text-xs font-semibold shrink-0",
                                  eligible ? "text-primary" : "text-muted-foreground",
                                ].join(" ")}
                              >
                                {eligible
                                  ? t("checkout.summary.couponApply")
                                  : t("checkout.summary.couponInsufficient")}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {!appliedCoupon ? (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                className="flex gap-2"
              >
                <input
                  id="checkout-coupon-input"
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
                  placeholder={t("checkout.summary.couponPlaceholder")}
                  className="flex-1 px-3 py-2 text-sm border border-border rounded-[var(--radius-lg)] outline-none focus:border-primary bg-card transition-colors"
                />
                <button
                  onClick={handleApplyCoupon}
                  disabled={!couponInput.trim() || couponMutation.isPending}
                  className="px-4 py-2 text-sm font-semibold text-white rounded-[var(--radius-lg)] bg-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                >
                  {t("checkout.summary.couponApply")}
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="applied"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-lg)] text-sm font-medium bg-primary-light text-primary">
                  <Check size={14} />
                  <span>{t("checkout.summary.couponApplied", { code: appliedCoupon })}</span>
                  {discount > 0 ? <span className="ml-1">-{formatPrice(discount)}</span> : null}
                </div>
                <button
                  onClick={handleRemoveCoupon}
                  className="px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t("checkout.summary.couponRemove")}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Totals */}
        <div className="border-t border-border pt-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("checkout.summary.subtotal")}</span>
            <span className="text-foreground">{formatPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("checkout.summary.shippingFee")}</span>
            <span className={shippingFee === 0 ? "text-success" : "text-foreground"}>
              {shippingFee === 0 ? t("checkout.summary.free") : formatPrice(shippingFee)}
            </span>
          </div>
          {discount > 0 ? (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("checkout.summary.discount")}</span>
              <span className="text-primary">-{formatPrice(discount)}</span>
            </div>
          ) : null}
          <div className="flex justify-between font-black text-base pt-2 border-t border-border">
            <span className="text-foreground">{t("checkout.summary.total")}</span>
            <span className="text-primary">{formatPrice(finalTotal)}</span>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={handleNext}
          disabled={isProcessing || !canSubmit || (step === "address" && addresses.length === 0)}
          className="w-full py-3.5 rounded-[var(--radius-lg)] bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              {t("checkout.summary.processing")}
            </span>
          ) : step === "review" ? (
            <>
              <CheckCircle size={16} /> {t("checkout.summary.placeOrder")}
            </>
          ) : (
            <>
              {t("checkout.summary.next")} <ChevronRight size={16} />
            </>
          )}
        </button>

        {step === "review" ? (
          <p className="text-[11px] text-muted-foreground text-center">
            {t("checkout.summary.termsNotice")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
