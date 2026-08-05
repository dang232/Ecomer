import { MessageCircle, ShoppingCart, Zap } from "lucide-react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { Button, IconButton } from "@/shared/ui";

import type { ProductDetailView } from "../model/product-view";

export interface MobilePurchaseBarProps {
  view: Pick<ProductDetailView, "seller" | "actions">;
  onContactSeller: () => void;
  onAddToCart: () => void;
  onBuyNow: () => void;
}

export function MobilePurchaseBar({
  view,
  onContactSeller,
  onAddToCart,
  onBuyNow,
}: MobilePurchaseBarProps) {
  const { t } = useTranslation();
  const canMessage = view.seller.status === "ready";

  const content = (
    <div
      className={`fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 grid gap-2 border-t border-border bg-card p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden ${
        canMessage ? "grid-cols-[auto_1fr_1fr]" : "grid-cols-2"
      }`}
    >
      {canMessage ? (
        <IconButton
          label={t("product.contactSeller", { defaultValue: "Contact seller" })}
          onClick={onContactSeller}
        >
          <MessageCircle />
        </IconButton>
      ) : null}
      <Button variant="outline" disabled={!view.actions.addToCart} onClick={onAddToCart}>
        <ShoppingCart className="h-4 w-4" aria-hidden="true" />
        {t("product.addToCart", { defaultValue: "Add to cart" })}
      </Button>
      <Button disabled={!view.actions.buyNow} onClick={onBuyNow}>
        <Zap className="h-4 w-4" aria-hidden="true" />
        {t("product.buyNow", { defaultValue: "Buy now" })}
      </Button>
    </div>
  );

  return createPortal(content, document.body);
}
