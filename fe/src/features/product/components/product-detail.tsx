import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { PageContainer, Tabs } from "@/shared/ui";

import type { ProductRouteState } from "../model/product-route-state";
import type { ProductDetailView } from "../model/product-view";

import { MobilePurchaseBar } from "./mobile-purchase-bar";
import { ProductGallery } from "./product-gallery";
import { ProductPurchasePanel } from "./product-purchase-panel";

export interface ProductDetailProps {
  view: ProductDetailView;
  route: ProductRouteState;
  badge?: string;
  colors?: readonly string[];
  sizes?: readonly string[];
  selectedColor: string;
  selectedSize: string;
  quantity: number;
  loved: boolean;
  onRouteChange: (updates: Partial<ProductRouteState>) => void;
  onQuantityChange: (quantity: number) => void;
  onSelectColor: (color: string) => void;
  onSelectSize: (size: string) => void;
  onToggleWishlist: () => void;
  onAddToCart: () => void;
  onBuyNow: () => void;
  onContactSeller: () => void;
  children?: ReactNode;
}

export function ProductDetail({
  view,
  route,
  badge,
  colors,
  sizes,
  selectedColor,
  selectedSize,
  quantity,
  loved,
  onRouteChange,
  onQuantityChange,
  onSelectColor,
  onSelectSize,
  onToggleWishlist,
  onAddToCart,
  onBuyNow,
  onContactSeller,
  children,
}: ProductDetailProps) {
  const { t } = useTranslation();
  const sectionItems = [
    { value: "details", label: t("product.detailTabs.details", { defaultValue: "Details" }) },
    { value: "reviews", label: t("product.detailTabs.reviews", { defaultValue: "Reviews" }) },
    { value: "questions", label: t("product.detailTabs.questions", { defaultValue: "Questions" }) },
    { value: "videos", label: t("product.detailTabs.videos", { defaultValue: "Videos" }) },
  ] as const;

  return (
    <PageContainer className="pb-40 md:pb-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductGallery media={view.media} badge={badge} />
        <ProductPurchasePanel
          view={view}
          quantity={quantity}
          selectedColor={selectedColor}
          selectedSize={selectedSize}
          colors={colors}
          sizes={sizes}
          loved={loved}
          onQuantityChange={onQuantityChange}
          onSelectColor={onSelectColor}
          onSelectSize={onSelectSize}
          onSelectVariant={(variant) => onRouteChange({ variant })}
          onToggleWishlist={onToggleWishlist}
          onAddToCart={onAddToCart}
          onBuyNow={onBuyNow}
          onOpenReviews={() => onRouteChange({ section: "reviews" })}
        />
      </div>
      <section
        className="mt-10"
        aria-label={t("product.information", { defaultValue: "Product information" })}
      >
        <Tabs
          ariaLabel={t("product.sections", { defaultValue: "Product sections" })}
          value={route.section}
          items={sectionItems}
          onValueChange={(section) => onRouteChange({ section })}
        />
        <div className="pt-6">{children}</div>
      </section>
      <MobilePurchaseBar
        view={view}
        onContactSeller={onContactSeller}
        onAddToCart={onAddToCart}
        onBuyNow={onBuyNow}
      />
    </PageContainer>
  );
}
