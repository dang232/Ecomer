import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { CartPageView, toCartView } from "@/features/cart";
import { ApiError } from "@/shared/api";
import { validateCouponCode } from "@/shared/api/endpoints/coupons";
import { FREE_SHIPPING_THRESHOLD, FLAT_SHIPPING_FEE } from "@/shared/contracts";

import { GuestCartMergeDialog } from "../components/GuestCartMergeDialog";
import { RecentlyViewedGrid } from "../components/RecentlyViewedGrid";
import { useAuth } from "../hooks/auth-context";
import { useCart } from "../hooks/use-cart";
import { useRecentlyViewed } from "../hooks/use-recently-viewed";

export function CartPage() {
  const navigate = useNavigate();
  const { ready, authenticated, login } = useAuth();
  const {
    items,
    isLoading,
    updateItem,
    removeItem,
    showMergeDialog,
    isMerging,
    executeMerge,
    keepSeparate,
    guestItemCount,
    serverItemCount,
  } = useCart();
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponError, setCouponError] = useState("");
  const { t } = useTranslation();
  const { items: recentlyViewed } = useRecentlyViewed();

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

  const handleApplyCoupon = () => {
    const code = coupon.toUpperCase().trim();
    if (!code || couponMutation.isPending) return;
    couponMutation.mutate({
      code,
      orderAmount: items.reduce((s, i) => s + i.price * i.quantity, 0),
    });
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setCouponError("");
    setCoupon("");
    couponMutation.reset();
  };

  const handleMerge = async () => {
    const success = await executeMerge();
    if (success) {
      toast.success(t("cart.merge.success"));
    } else {
      toast.error(t("cart.merge.failed"));
    }
  };

  const handleKeepSeparate = () => keepSeparate();

  const onQuantityChange = (line: { productId: string; variantId?: string }, quantity: number) => {
    if (quantity <= 0) {
      removeItem(
        { productId: line.productId, variantId: line.variantId },
        {
          onError: (err) =>
            toast.error(err instanceof ApiError ? err.message : t("cart.errors.cantRemove")),
        },
      );
      return;
    }
    if (quantity > 99) {
      toast.warning(t("cart.errors.maxQty", { max: 99 }));
      return;
    }
    updateItem(
      { productId: line.productId, quantity, variantId: line.variantId },
      {
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : t("cart.errors.cantUpdate")),
      },
    );
  };

  const onRemove = (line: { productId: string; variantId?: string }) =>
    removeItem(
      { productId: line.productId, variantId: line.variantId },
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

  const shippingFeeVnd =
    items.reduce((s, i) => s + i.price * i.quantity, 0) >= FREE_SHIPPING_THRESHOLD
      ? 0
      : FLAT_SHIPPING_FEE;

  return (
    <>
      <CartPageView
        view={toCartView(items)}
        shippingFeeVnd={shippingFeeVnd}
        couponDiscountVnd={couponDiscount}
        coupon={coupon}
        appliedCoupon={appliedCoupon}
        couponError={couponError}
        couponPending={couponMutation.isPending}
        authenticated={authenticated}
        onQuantityChange={onQuantityChange}
        onRemove={onRemove}
        onCouponChange={setCoupon}
        onApplyCoupon={handleApplyCoupon}
        onRemoveCoupon={handleRemoveCoupon}
        onLogin={() => login("/checkout")}
        onCheckout={() => navigate("/checkout")}
        onContinueShopping={() => navigate("/")}
        supplementary={
          recentlyViewed.length > 0 ? (
            <RecentlyViewedGrid
              title={t("home.recentlyViewed", { defaultValue: "Recently Viewed" })}
              items={recentlyViewed}
            />
          ) : undefined
        }
      />
      <GuestCartMergeDialog
        open={showMergeDialog}
        onClose={keepSeparate}
        onMerge={handleMerge}
        onKeepSeparate={handleKeepSeparate}
        guestItemCount={guestItemCount}
        serverItemCount={serverItemCount}
        isMerging={isMerging}
      />
    </>
  );
}
