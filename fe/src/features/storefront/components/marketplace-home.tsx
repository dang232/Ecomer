import { PackageSearch } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { ProductGrid, TrustCues } from "@/shared/commerce";
import { EmptyState, PageContainer, Skeleton } from "@/shared/ui";

import type { HomeMarketplaceView } from "../model/home-view";

import { CampaignBand } from "./campaign-band";
import { CategoryRail } from "./category-rail";
import { FlashSaleShelf } from "./flash-sale-shelf";
import { ServiceShortcuts } from "./service-shortcuts";
import { TrustedSellerRail } from "./trusted-seller-rail";

export interface MarketplaceHomeProps {
  view: HomeMarketplaceView;
}

function ProductSection({
  title,
  products,
}: {
  title: string;
  products: HomeMarketplaceView["recommendations"];
}) {
  if (products.length === 0) return null;
  return (
    <section aria-label={title} className="space-y-4">
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      <ProductGrid products={products} />
    </section>
  );
}

export function MarketplaceHome({ view }: MarketplaceHomeProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const hasContent =
    view.campaign !== null ||
    view.categories.length > 0 ||
    view.flashSale.length > 0 ||
    view.recommendations.length > 0;

  if (!hasContent) {
    return (
      <PageContainer>
        <EmptyState
          icon={<PackageSearch />}
          title={t("storefront.empty.title")}
          description={t("storefront.empty.description")}
          action={{ label: t("storefront.empty.action"), onClick: () => void navigate("/search") }}
        />
      </PageContainer>
    );
  }

  return (
    <div className="space-y-8 pb-4">
      <PageContainer className="space-y-6">
        <CampaignBand campaign={view.campaign} secondaryProducts={view.flashSale.slice(1, 3)} />
        <ServiceShortcuts items={view.shortcuts} />
        <CategoryRail categories={view.categories} />
      </PageContainer>
      <FlashSaleShelf products={view.flashSale} />
      <PageContainer className="space-y-10">
        <TrustedSellerRail sellers={view.featuredSellers} />
        <ProductSection title={t("home.suggestions")} products={view.recommendations} />
        <ProductSection title={t("home.recentlyViewed")} products={view.recentlyViewed} />
        <TrustCues
          cues={[
            {
              id: "buyer-protection",
              label: t("storefront.trust.protection"),
              detail: t("storefront.trust.protectionDetail"),
            },
            {
              id: "returns",
              label: t("storefront.trust.returns"),
              detail: t("storefront.trust.returnsDetail"),
            },
            {
              id: "shipping",
              label: t("storefront.trust.shipping"),
              detail: t("storefront.trust.shippingDetail"),
            },
          ]}
        />
      </PageContainer>
    </div>
  );
}

export function MarketplaceHomeSkeleton() {
  return (
    <PageContainer
      className="space-y-6"
      role="status"
      aria-busy="true"
      aria-label="Loading storefront"
    >
      <Skeleton className="aspect-[16/10] w-full sm:aspect-[2.4/1]" />
      <div className="grid grid-cols-5 gap-3 border-y border-border py-3">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-12" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="aspect-[3/4]" />
        ))}
      </div>
    </PageContainer>
  );
}
