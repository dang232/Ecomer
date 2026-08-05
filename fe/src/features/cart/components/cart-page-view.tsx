import { ShoppingBag, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button, ConfirmDialog, PageContainer, PageHeader } from "@/shared/ui";

import type { CartLineView, CartView } from "../model/cart-view";

import { CartSummary } from "./cart-summary";
import { SellerCartGroup } from "./seller-cart-group";

interface CartPageViewProps {
  view: CartView;
  subtotalVnd?: number;
  pendingLineKey?: string | null;
  shippingFeeVnd: number;
  couponDiscountVnd: number;
  coupon: string;
  appliedCoupon: string | null;
  couponError?: string;
  couponPending?: boolean;
  authenticated: boolean;
  supplementary?: ReactNode;
  onQuantityChange: (line: CartLineView, quantity: number) => void;
  onRemove: (line: CartLineView) => void;
  onClear: () => void;
  onCouponChange: (value: string) => void;
  onApplyCoupon: () => void;
  onRemoveCoupon: () => void;
  onLogin: () => void;
  onCheckout: () => void;
  onContinueShopping: () => void;
}

export function CartPageView({
  view,
  subtotalVnd,
  pendingLineKey,
  shippingFeeVnd,
  couponDiscountVnd,
  coupon,
  appliedCoupon,
  couponError,
  couponPending,
  authenticated,
  supplementary,
  onQuantityChange,
  onRemove,
  onClear,
  onCouponChange,
  onApplyCoupon,
  onRemoveCoupon,
  onLogin,
  onCheckout,
  onContinueShopping,
}: CartPageViewProps) {
  const { t } = useTranslation();
  const [lineToRemove, setLineToRemove] = useState<CartLineView | null>(null);
  const [clearRequested, setClearRequested] = useState(false);

  if (view.groups.length === 0) {
    return (
      <PageContainer className="pb-24 sm:pb-8">
        <div className="mx-auto max-w-xl py-16 text-center">
          <ShoppingBag className="mx-auto h-14 w-14 text-muted-foreground/40" aria-hidden="true" />
          <h1 className="mt-5 text-2xl font-bold text-foreground">{t("cart.emptyTitle")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("cart.emptySub")}</p>
          <Button className="mt-6" onClick={onContinueShopping}>
            {t("cart.continueShopping")}
          </Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="pb-24 sm:pb-8">
      <PageHeader
        title={t("cart.title")}
        description={t("cart.itemCount", { count: view.itemCount })}
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => setClearRequested(true)}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {t("cart.clear")}
          </Button>
        }
        className="mb-6"
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="space-y-4">
          {view.groups.map((group) => (
            <SellerCartGroup
              key={group.sellerId}
              group={group}
              pendingLineKey={pendingLineKey}
              onQuantityChange={onQuantityChange}
              onRemoveRequest={setLineToRemove}
            />
          ))}
          <button
            type="button"
            onClick={onContinueShopping}
            className="text-sm font-semibold text-primary hover:underline"
          >
            {t("cart.continueShopping")}
          </button>
          {supplementary}
        </div>
        <aside className="self-start lg:sticky lg:top-32">
          <CartSummary
            itemCount={view.itemCount}
            subtotalVnd={subtotalVnd ?? view.subtotalVnd}
            shippingFeeVnd={shippingFeeVnd}
            couponDiscountVnd={couponDiscountVnd}
            coupon={coupon}
            appliedCoupon={appliedCoupon}
            couponError={couponError}
            couponPending={couponPending}
            authenticated={authenticated}
            onCouponChange={onCouponChange}
            onApplyCoupon={onApplyCoupon}
            onRemoveCoupon={onRemoveCoupon}
            onLogin={onLogin}
            onCheckout={onCheckout}
          />
        </aside>
      </div>
      <ConfirmDialog
        open={lineToRemove !== null}
        onClose={() => setLineToRemove(null)}
        onConfirm={() => lineToRemove && onRemove(lineToRemove)}
        title={t("cart.removeConfirmTitle")}
        description={t("cart.removeConfirmDescription", { name: lineToRemove?.name ?? "" })}
        confirmLabel={t("cart.removeItem")}
        cancelLabel={t("common.cancel")}
        variant="danger"
        icon={<Trash2 className="h-5 w-5" />}
      />
      <ConfirmDialog
        open={clearRequested}
        onClose={() => setClearRequested(false)}
        onConfirm={() => {
          setClearRequested(false);
          onClear();
        }}
        title={t("cart.clearConfirmTitle")}
        description={t("cart.clearConfirmDescription")}
        confirmLabel={t("cart.clearConfirm")}
        cancelLabel={t("common.cancel")}
        variant="danger"
        icon={<Trash2 className="h-5 w-5" />}
      />
    </PageContainer>
  );
}
