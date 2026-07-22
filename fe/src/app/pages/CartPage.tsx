import { useMutation } from "@tanstack/react-query";
import {
  CreditCard,
  Lock,
  LogIn,
  Minus,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Store,
  Tag,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { GuestCartMergeDialog } from "../components/GuestCartMergeDialog";
import { ImageWithFallback } from "../components/image-with-fallback";
import { RecentlyViewedGrid } from "../components/RecentlyViewedGrid";
import { useAppConfig } from "../hooks/use-app-config";
import { useAuth } from "../hooks/use-auth";
import { useCart } from "../hooks/use-cart";
import { useRecentlyViewed } from "../hooks/use-recently-viewed";
import { ApiError } from "../lib/api";
import { validateCouponCode } from "../lib/api/endpoints/coupons";
import { FREE_SHIPPING_THRESHOLD, FLAT_SHIPPING_FEE } from "../lib/domain-constants";
import { formatPrice } from "../lib/format";
import type { CartItem } from "../types/api";

export function CartPage() {
  const navigate = useNavigate();
  const { ready, authenticated, login } = useAuth();
  const config = useAppConfig();
  const {
    items,
    itemCount,
    totalAmount,
    isLoading,
    isHydrating,
    error,
    updateItem,
    removeItem,
    showMergeDialog,
    isMerging,
    requestMerge,
    executeMerge,
    keepSeparate,
    guestItemCount,
    serverItemCount,
    hasItemsWithoutVariant,
    isGuest,
  } = useCart();
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponError, setCouponError] = useState("");
  const { t } = useTranslation();
  const { items: recentlyViewed } = useRecentlyViewed();

  // The real discount lands at checkout (/checkout/calculate is server-authoritative).
  // For the cart preview we hit /coupons/validate so the buyer sees the same code/discount
  // they will see on the checkout summary.
  const couponMutation = useMutation({
    mutationFn: validateCouponCode,
    onSuccess: (result, variables) => {
      if (result.valid) {
        setAppliedCoupon(variables.code);
        setCouponDiscount(result.discount ?? 0);
        setCouponError("");
        return;
      }
      setAppliedCoupon(null);
      setCouponDiscount(0);
      setCouponError(result.message || t("cart.couponInvalid"));
    },
    onError: (err) => {
      setAppliedCoupon(null);
      setCouponDiscount(0);
      setCouponError(err instanceof ApiError ? err.message : t("cart.couponInvalid"));
    },
  });

  const shippingFee = totalAmount >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_FEE;
  const finalTotal = Math.max(0, totalAmount - couponDiscount) + shippingFee;

  const handleApplyCoupon = () => {
    const code = coupon.toUpperCase().trim();
    if (!code || couponMutation.isPending) return;
    couponMutation.mutate({ code, orderAmount: totalAmount });
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setCouponError("");
    setCoupon("");
    couponMutation.reset();
  };

  // Merge dialog handlers
  const handleMerge = async () => {
    const success = await executeMerge();
    if (success) {
      toast.success(t("cart.merge.success"));
    } else {
      toast.error(t("cart.merge.failed"));
    }
  };

  const handleKeepSeparate = () => {
    keepSeparate();
  };

  const handleRequestMerge = () => {
    if (hasItemsWithoutVariant) {
      toast.warning(t("cart.merge.variantWarning"));
    }
    requestMerge();
  };

  const MAX_ITEM_QTY = 99;

  const onUpdate = (productId: string, quantity: number, variantId?: string) => {
    if (quantity <= 0) {
      removeItem(
        { productId, variantId },
        {
          onError: (err) =>
            toast.error(err instanceof ApiError ? err.message : t("cart.errors.cantRemove")),
        },
      );
      return;
    }
    if (quantity > MAX_ITEM_QTY) {
      toast.warning(t("cart.errors.maxQty", { max: MAX_ITEM_QTY }));
      return;
    }
    updateItem(
      { productId, quantity, variantId },
      {
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : t("cart.errors.cantUpdate")),
      },
    );
  };

  const onRemove = (productId: string, variantId?: string) =>
    removeItem(
      { productId, variantId },
      {
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : t("cart.errors.cantRemove")),
      },
    );

  if (!ready) {
    return (
      <div className="max-w-[1200px] mx-auto px-[var(--content-padding)] py-24 text-center text-sm text-muted-foreground">
        {t("cart.initSession")}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-[1200px] mx-auto px-[var(--content-padding)] py-24 text-center text-sm text-muted-foreground">
        {t("cart.loading")}
      </div>
    );
  }

  if (error) {
    const message = error instanceof ApiError ? error.message : t("cart.loadError");
    return (
      <div className="max-w-[1200px] mx-auto px-[var(--content-padding)] py-24 text-center">
        <h2 className="text-xl font-semibold text-foreground mb-3">{message}</h2>
        <button
          onClick={() => navigate("/")}
          className="px-6 py-2.5 rounded-[var(--radius-lg)] text-white font-medium bg-primary hover:bg-primary-hover transition-colors"
        >
          {t("cart.backToHome")}
        </button>
      </div>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <div className="max-w-[1200px] mx-auto px-[var(--content-padding)] py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16 px-6 bg-card border border-border rounded-[var(--radius-xl)]"
        >
          <ShoppingBag size={64} className="mx-auto mb-6 text-muted-foreground opacity-30" />
          <h2 className="text-2xl font-bold text-foreground mb-3">{t("cart.emptyTitle")}</h2>
          <p className="text-muted-foreground mb-8">{t("cart.emptySub")}</p>
          <button
            onClick={() => navigate("/")}
            className="px-8 py-3.5 rounded-[var(--radius-lg)] text-white font-semibold bg-primary hover:bg-primary-hover hover:-translate-y-0.5 hover:shadow-lg transition-all"
          >
            {t("cart.continueShopping")}
          </button>
        </motion.div>
      </div>
    );
  }

  // Group by seller
  const grouped = items.reduce<Record<string, { sellerName: string; items: CartItem[] }>>(
    (acc, item) => {
      const sid = item.sellerId ?? "_";
      if (!acc[sid]) {
        acc[sid] = { sellerName: item.sellerName ?? t("cart.sellerFallback"), items: [] };
      }
      acc[sid].items.push(item);
      return acc;
    },
    {},
  );

  // Flatten items for stagger index
  const flatItems = Object.values(grouped).flatMap((g) => g.items);

  return (
    <div className="max-w-[1200px] mx-auto py-8 px-[var(--content-padding)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          {t("cart.title", { defaultValue: "Shopping Cart" })}
        </h1>
        <span className="text-sm text-text-secondary">
          {t("cart.itemCountLabel", { count: itemCount, defaultValue: `${itemCount} items` })}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        {/* Cart Items Column */}
        <div className="flex flex-col gap-3">
          <AnimatePresence>
            {flatItems.map((item, index) => (
              <motion.div
                key={item.variantId ? `${item.productId}:${item.variantId}` : item.productId}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ delay: index * 0.05 }}
                className="flex gap-4 p-4 bg-card border border-border rounded-[var(--radius-lg)] transition-all hover:border-border-hover hover:shadow-sm"
              >
                {/* Image */}
                <button
                  type="button"
                  aria-label={`${t("cart.viewProduct", { defaultValue: "View" })} ${item.name ?? item.productId}`}
                  onClick={() => navigate(`/product/${item.productId}`)}
                  className="w-[100px] h-[100px] rounded-[var(--radius-md)] bg-surface-elevated flex-shrink-0 flex items-center justify-center overflow-hidden border-0 p-0"
                >
                  <ImageWithFallback
                    src={item.image ?? ""}
                    alt={item.name ?? ""}
                    className="w-full h-full object-cover"
                  />
                </button>

                {/* Info area */}
                <div className="flex-1 min-w-0 flex flex-col">
                  <button
                    onClick={() => navigate(`/product/${item.productId}`)}
                    className="text-sm font-medium text-foreground line-clamp-2 text-left hover:underline"
                  >
                    {item.name ?? item.productId}
                  </button>

                  {/* Seller */}
                  {item.sellerName ? (
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                      <Store size={12} />
                      {item.sellerName}
                    </span>
                  ) : null}

                  {/* Bottom row */}
                  <div className="flex items-center justify-between mt-auto pt-3">
                    {/* Price */}
                    <div className="flex items-baseline gap-1">
                      {isHydrating ? (
                        <div className="animate-pulse h-5 bg-muted rounded w-20" />
                      ) : item.price > 0 ? (
                        <span className="text-lg font-bold text-primary">
                          {formatPrice(item.price * item.quantity)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {t("cart.priceUnavailable")}
                        </span>
                      )}
                    </div>

                    {/* Right: quantity stepper + remove */}
                    <div className="flex items-center gap-2">
                      {/* Quantity stepper */}
                      <div className="flex items-center border-[1.5px] border-border rounded-[var(--radius-md)] overflow-hidden">
                        <button
                          onClick={() =>
                            onUpdate(item.productId, item.quantity - 1, item.variantId)
                          }
                          aria-label="Decrease quantity"
                          className="w-[30px] h-[30px] flex items-center justify-center hover:bg-surface-elevated hover:text-primary transition-colors"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="w-9 text-center text-sm font-semibold border-l border-r border-border py-1">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            onUpdate(item.productId, item.quantity + 1, item.variantId)
                          }
                          aria-label="Increase quantity"
                          className="w-[30px] h-[30px] flex items-center justify-center hover:bg-surface-elevated hover:text-primary transition-colors"
                        >
                          <Plus size={13} />
                        </button>
                      </div>

                      {/* Remove button */}
                      <button
                        onClick={() => onRemove(item.productId, item.variantId)}
                        aria-label={`Remove ${item.name ?? "item"} from cart`}
                        className="w-[30px] h-[30px] flex items-center justify-center rounded-[var(--radius-sm)] text-muted-foreground hover:text-error hover:bg-error-light transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm font-medium text-primary hover:underline self-start"
          >
            {t("cart.continueShopping")}
          </button>

          {/* Recently Viewed */}
          {recentlyViewed.length > 0 ? (
            <RecentlyViewedGrid
              title={t("home.recentlyViewed", { defaultValue: "Recently Viewed" })}
              items={recentlyViewed}
            />
          ) : null}
        </div>

        {/* Summary Sidebar */}
        <div className="sticky top-[80px] bg-card border border-border rounded-[var(--radius-xl)] p-6">
          <h3 className="text-base font-bold mb-5">{t("cart.summaryTitle")}</h3>

          {/* Summary rows */}
          <div>
            <div className="flex justify-between py-2.5 text-sm">
              <span className="text-muted-foreground">
                {t("cart.subtotal", { count: itemCount })}
              </span>
              <span className="font-semibold">{formatPrice(totalAmount)}</span>
            </div>

            <div className="flex justify-between py-2.5 text-sm">
              <span className="text-muted-foreground">{t("cart.shippingFee")}</span>
              <span className={shippingFee === 0 ? "font-semibold text-success" : "font-semibold"}>
                {shippingFee === 0 ? t("cart.free") : formatPrice(shippingFee)}
              </span>
            </div>

            {couponDiscount > 0 ? (
              <div className="flex justify-between py-2.5 text-sm">
                <span className="text-muted-foreground">{t("cart.voucherDiscount")}</span>
                <span className="font-semibold text-success">-{formatPrice(couponDiscount)}</span>
              </div>
            ) : null}

            {/* Total row */}
            <div className="border-t-[1.5px] border-border mt-2 pt-4 flex justify-between items-baseline text-lg font-bold">
              <span>{t("cart.totalLabel")}</span>
              <span className="text-primary text-xl">{formatPrice(finalTotal)}</span>
            </div>
          </div>

          {/* Savings badge */}
          {couponDiscount > 0 ? (
            <div className="flex items-center gap-1 mt-2 p-2 px-3 bg-success-light rounded-[var(--radius-md)] text-xs text-success">
              <Tag size={12} />
              {t("cart.savings", { amount: formatPrice(couponDiscount) })}
            </div>
          ) : null}

          {/* Coupon input */}
          <div className="flex gap-2 my-4">
            <input
              value={coupon}
              onChange={(e) => setCoupon(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
              placeholder={t("cart.couponPlaceholder")}
              className="flex-1 px-3 py-2.5 border-[1.5px] border-border rounded-[var(--radius-md)] text-sm outline-none focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-light)] uppercase tracking-wider bg-card transition-all"
            />
            <button
              onClick={handleApplyCoupon}
              disabled={!coupon.trim() || couponMutation.isPending}
              className="px-4 py-2.5 bg-primary-light text-primary text-sm font-semibold rounded-[var(--radius-md)] hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {couponMutation.isPending ? t("cart.couponApplying") : t("cart.couponApply")}
            </button>
          </div>

          {/* Coupon status */}
          <div aria-live="polite" aria-atomic="true">
            {couponError ? <p className="text-xs text-error mt-1.5">{couponError}</p> : null}
            {appliedCoupon ? (
              <div className="mt-2 flex items-center justify-between px-3 py-2 rounded-[var(--radius-md)] text-sm bg-primary-light">
                <span className="text-primary">
                  {t("cart.couponApplied", { code: appliedCoupon })}
                  {couponDiscount > 0 ? ` · -${formatPrice(couponDiscount)}` : ""}
                </span>
                <button
                  onClick={handleRemoveCoupon}
                  className="text-muted-foreground hover:text-error text-xs"
                >
                  {t("cart.couponRemove")}
                </button>
              </div>
            ) : null}
          </div>

          {/* Guest banner - show login prompt for guests */}
          {!authenticated ? (
            <div className="mt-5 mb-3 flex items-center justify-between gap-3 rounded-[var(--radius-lg)] px-4 py-3 bg-primary-light border border-primary/20">
              <div className="flex items-center gap-2 min-w-0">
                <LogIn size={16} className="text-primary shrink-0" />
                <span className="text-sm font-medium text-primary">{t("cart.guestBanner")}</span>
              </div>
              <button
                onClick={() => login("/checkout")}
                className="shrink-0 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-semibold text-white bg-primary hover:bg-primary-hover transition-colors"
              >
                {t("cart.loginBtn")}
              </button>
            </div>
          ) : null}

          {/* Merge cart banner for authenticated users with both guest and server cart items */}
          {authenticated && !isGuest && guestItemCount > 0 && serverItemCount > 0 ? (
            <div className="mt-5 mb-3 flex items-center justify-between gap-3 rounded-[var(--radius-lg)] px-4 py-3 bg-primary-light border border-primary/20">
              <div className="flex items-center gap-2 min-w-0">
                <ShoppingBag size={16} className="text-primary shrink-0" />
                <span className="text-sm font-medium text-primary">
                  {t("cart.merge.description", {
                    guestCount: guestItemCount,
                    serverCount: serverItemCount,
                  })}
                </span>
              </div>
              <button
                onClick={handleRequestMerge}
                className="shrink-0 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-semibold text-white bg-primary hover:bg-primary-hover transition-colors"
              >
                {t("cart.merge.mergeBtn")}
              </button>
            </div>
          ) : null}

          {/* Checkout button */}
          <button
            onClick={() => navigate("/checkout")}
            disabled={!authenticated}
            aria-disabled={!authenticated}
            className="w-full py-3.5 bg-primary text-white text-base font-bold rounded-[var(--radius-lg)] flex items-center justify-center gap-2 hover:bg-primary-hover hover:enabled:-translate-y-0.5 hover:enabled:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all mt-2"
          >
            <Lock size={16} />
            {t("cart.proceedCheckout")}
          </button>

          {/* Payment methods */}
          {config.payment.providers.length > 0 ? (
            <div className="flex items-center justify-center gap-2 mt-3" aria-hidden="true">
              {config.payment.providers.map((method) => (
                <div
                  key={method}
                  className="px-2 py-1 bg-muted rounded-[var(--radius-sm)] text-[10px] font-medium text-muted-foreground"
                >
                  {method}
                </div>
              ))}
            </div>
          ) : null}

          {/* Guarantees */}
          <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-border">
            <div className="text-xs text-text-secondary flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-success" />
              {t("cart.guarantee.buyerProtection", {
                defaultValue: "Buyer protection on all orders",
              })}
            </div>
            <div className="text-xs text-text-secondary flex items-center gap-1.5">
              <RefreshCw size={14} className="text-success" />
              {t("cart.guarantee.returns", { defaultValue: "7-day free returns" })}
            </div>
            <div className="text-xs text-text-secondary flex items-center gap-1.5">
              <CreditCard size={14} className="text-success" />
              {t("cart.guarantee.securePayment", {
                defaultValue: "Secure payment via VNPay, MoMo, Stripe",
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Merge Cart Dialog */}
      <GuestCartMergeDialog
        open={showMergeDialog}
        onClose={keepSeparate}
        onMerge={handleMerge}
        onKeepSeparate={handleKeepSeparate}
        guestItemCount={guestItemCount}
        serverItemCount={serverItemCount}
        isMerging={isMerging}
      />
    </div>
  );
}
