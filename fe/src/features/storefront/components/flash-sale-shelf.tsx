import { Timer } from "lucide-react";
import { useTranslation } from "react-i18next";

import { HorizontalRail, ProductTile, type ProductTileView } from "@/shared/commerce";
import { EmptyState } from "@/shared/ui";

export interface FlashSaleShelfProps {
  products: readonly ProductTileView[];
}

export function FlashSaleShelf({ products }: FlashSaleShelfProps) {
  const { t } = useTranslation();

  if (products.length === 0) {
    return (
      <section className="border-y border-border bg-surface py-5">
        <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8">
          <div className="mb-4 flex items-center gap-2 text-primary">
            <Timer className="h-5 w-5" aria-hidden="true" />
            <span className="text-sm font-semibold">{t("storefront.flashSale.endsSoon")}</span>
          </div>
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">{t("flashSale.title")}</h2>
            <EmptyState
              icon={<Timer />}
              title={t("flashSale.emptyTitle")}
              description={t("flashSale.emptyBody")}
            />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="border-y border-border bg-surface py-5">
      <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-center gap-2 text-primary">
          <Timer className="h-5 w-5" aria-hidden="true" />
          <span className="text-sm font-semibold">{t("storefront.flashSale.endsSoon")}</span>
        </div>
        <HorizontalRail title={t("flashSale.title")}>
          {products.map((product) => (
            <div key={product.id} className="snap-start">
              <ProductTile product={product} href={`/product/${product.id}`} />
            </div>
          ))}
        </HorizontalRail>
      </div>
    </section>
  );
}
