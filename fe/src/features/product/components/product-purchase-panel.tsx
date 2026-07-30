import { Heart, Minus, Plus, ShoppingCart, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Rating } from "@/shared/commerce";
import { formatPrice } from "@/shared/lib";
import { Button, IconButton, StatusIndicator } from "@/shared/ui";

import type { ProductDetailView } from "../model/product-view";

import { ProductTrustSection } from "./product-trust-section";

export interface ProductPurchasePanelProps {
  view: ProductDetailView;
  quantity: number;
  selectedColor: string;
  selectedSize: string;
  colors?: readonly string[];
  sizes?: readonly string[];
  loved: boolean;
  onQuantityChange: (quantity: number) => void;
  onSelectColor: (color: string) => void;
  onSelectSize: (size: string) => void;
  onSelectVariant: (sku: string) => void;
  onToggleWishlist: () => void;
  onAddToCart: () => void;
  onBuyNow: () => void;
  onOpenReviews: () => void;
}

export function ProductPurchasePanel({
  view,
  quantity,
  selectedColor,
  selectedSize,
  colors = [],
  sizes = [],
  loved,
  onQuantityChange,
  onSelectColor,
  onSelectSize,
  onSelectVariant,
  onToggleWishlist,
  onAddToCart,
  onBuyNow,
  onOpenReviews,
}: ProductPurchasePanelProps) {
  const { t } = useTranslation();
  const unavailable = view.stockState === "unavailable";

  return (
    <section
      className="space-y-5"
      aria-label={t("product.purchase", { defaultValue: "Purchase product" })}
    >
      <div>
        <h1 className="text-2xl font-bold leading-tight text-foreground sm:text-3xl">
          {view.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Rating value={view.rating} soldCount={view.soldCount} />
          {view.rating !== undefined ? (
            <button
              type="button"
              onClick={onOpenReviews}
              className="text-sm text-muted-foreground underline hover:text-primary"
            >
              {t("product.detailTabs.reviews", { defaultValue: "Reviews" })}
            </button>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
        <span className="text-3xl font-bold text-primary">{formatPrice(view.priceVnd)}</span>
        {view.originalPriceVnd && view.originalPriceVnd > view.priceVnd ? (
          <s className="text-base text-muted-foreground">{formatPrice(view.originalPriceVnd)}</s>
        ) : null}
      </div>
      {colors.length > 0 ? (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-foreground">
            {t("product.colorsLabel", { defaultValue: "Color" })}:{" "}
            <span className="font-normal text-muted-foreground">{selectedColor}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {colors.map((color) => (
              <Button
                key={color}
                type="button"
                size="sm"
                variant={selectedColor === color ? "primary" : "outline"}
                onClick={() => onSelectColor(color)}
              >
                {color}
              </Button>
            ))}
          </div>
        </fieldset>
      ) : null}
      {sizes.length > 0 ? (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-foreground">
            {t("product.sizesLabel", { defaultValue: "Size" })}:{" "}
            <span className="font-normal text-muted-foreground">{selectedSize}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {sizes.map((size) => (
              <Button
                key={size}
                type="button"
                size="sm"
                variant={selectedSize === size ? "primary" : "outline"}
                onClick={() => onSelectSize(size)}
              >
                {size}
              </Button>
            ))}
          </div>
        </fieldset>
      ) : null}
      {view.variants.length > 0 ? (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-foreground">
            {t("product.variants", { defaultValue: "Options" })}
          </legend>
          <div className="flex flex-wrap gap-2">
            {view.variants.map((variant) => (
              <Button
                key={variant.sku}
                type="button"
                size="sm"
                variant={view.selectedVariant?.sku === variant.sku ? "primary" : "outline"}
                disabled={!variant.available}
                onClick={() => onSelectVariant(variant.sku)}
              >
                {variant.label}
              </Button>
            ))}
          </div>
        </fieldset>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-foreground">
          {t("product.quantityLabel", { defaultValue: "Quantity" })}
        </span>
        <div className="flex h-10 items-center overflow-hidden rounded-[var(--radius-control)] border border-border">
          <IconButton
            label={t("product.decreaseQuantity", { defaultValue: "Decrease quantity" })}
            onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
            className="h-full rounded-none"
          >
            <Minus />
          </IconButton>
          <span className="w-10 text-center text-sm font-semibold text-foreground">{quantity}</span>
          <IconButton
            label={t("product.increaseQuantity", { defaultValue: "Increase quantity" })}
            onClick={() => onQuantityChange(quantity + 1)}
            disabled={unavailable}
            className="h-full rounded-none"
          >
            <Plus />
          </IconButton>
        </div>
        <StatusIndicator
          tone={unavailable ? "danger" : view.stockState === "low-stock" ? "warning" : "success"}
        >
          {unavailable
            ? t("product.outOfStock", { defaultValue: "Out of stock" })
            : view.stockState === "low-stock"
              ? t("product.lowStock", { defaultValue: "Low stock" })
              : t("product.inStock", { defaultValue: "In stock" })}
        </StatusIndicator>
      </div>
      <ProductTrustSection view={view} />
      <div className="hidden flex-wrap gap-3 md:flex">
        <Button variant="outline" disabled={!view.actions.addToCart} onClick={onAddToCart}>
          <ShoppingCart className="h-4 w-4" aria-hidden="true" />
          {t("product.addToCart", { defaultValue: "Add to cart" })}
        </Button>
        <Button disabled={!view.actions.buyNow} onClick={onBuyNow}>
          <Zap className="h-4 w-4" aria-hidden="true" />
          {t("product.buyNow", { defaultValue: "Buy now" })}
        </Button>
        <IconButton
          label={
            loved
              ? t("product.removeWishlist", { defaultValue: "Remove from wishlist" })
              : t("product.addWishlist", { defaultValue: "Add to wishlist" })
          }
          variant={loved ? "primary" : "outline"}
          onClick={onToggleWishlist}
        >
          <Heart fill={loved ? "currentColor" : "none"} />
        </IconButton>
      </div>
    </section>
  );
}
