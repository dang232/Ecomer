import { useTranslation } from "react-i18next";

import {
  MarketplaceHome,
  MarketplaceHomeSkeleton,
  toHomeMarketplaceView,
  type HomeProductSource,
} from "@/features/storefront";
import { AsyncState, InlineAlert } from "@/shared/ui";

import { useCategories } from "../hooks/use-categories";
import { useFlashSaleWithProducts } from "../hooks/use-flash-sale";
import { useProducts } from "../hooks/use-products";
import { useRecentlyViewed } from "../hooks/use-recently-viewed";
import { useSellerShowcase } from "../hooks/use-sellers";
import { cdnUrl } from "../lib/image-url";

function toRecentProduct(item: {
  productId: string;
  name: string;
  image: string;
  price: number;
  rating: number;
}): HomeProductSource {
  return {
    id: item.productId,
    name: item.name,
    image: item.image,
    price: item.price,
    rating: item.rating,
    stockState: "in-stock",
  };
}

export function HomePage() {
  const { t } = useTranslation();
  const categoriesQuery = useCategories();
  const flashSaleQuery = useFlashSaleWithProducts();
  const productsQuery = useProducts({ size: 20 });
  const sellersQuery = useSellerShowcase();
  const { items: recentlyViewed } = useRecentlyViewed();

  const flashProducts: HomeProductSource[] = flashSaleQuery.items.map(({ campaign }) => ({
    id: campaign.productId,
    name: campaign.name?.trim() || campaign.productId,
    image: cdnUrl(campaign.imageHash),
    price: campaign.salePrice,
    originalPrice: campaign.originalPrice,
    sellerName: campaign.shopName?.trim() || undefined,
    stock: campaign.stockRemaining ?? campaign.stockTotal,
  }));
  const view = toHomeMarketplaceView({
    categories: categoriesQuery.data ?? [],
    flashProducts,
    sellers: sellersQuery.data?.content ?? [],
    recommendations: productsQuery.data ?? [],
    recentlyViewed: recentlyViewed.map(toRecentProduct),
  });
  const initialLoading =
    (categoriesQuery.isLoading && !categoriesQuery.data) ||
    (productsQuery.isLoading && !productsQuery.data);
  const requiredError = categoriesQuery.isError && productsQuery.isError;
  const partial =
    categoriesQuery.isError ||
    productsQuery.isError ||
    flashSaleQuery.error !== null ||
    sellersQuery.isError;
  const retry = () => {
    void categoriesQuery.refetch();
    void productsQuery.refetch();
    void sellersQuery.refetch();
  };

  if (initialLoading) return <MarketplaceHomeSkeleton />;

  if (requiredError) {
    return (
      <AsyncState
        status="error"
        loading={<MarketplaceHomeSkeleton />}
        empty={<p>{t("storefront.empty.title")}</p>}
        error={<p>{t("storefront.error.title")}</p>}
        retry={{ label: t("storefront.error.retry"), onClick: retry }}
      >
        {null}
      </AsyncState>
    );
  }

  const content = <MarketplaceHome view={view} />;
  return (
    <AsyncState
      status={partial ? "partial" : "ready"}
      loading={<MarketplaceHomeSkeleton />}
      empty={<p>{t("storefront.empty.title")}</p>}
      error={<p>{t("storefront.error.title")}</p>}
      partial={
        <>
          <div className="mx-auto w-full max-w-[1440px] px-4 pt-4 sm:px-6 lg:px-8">
            <InlineAlert tone="warning" title={t("storefront.partial.title")}>
              {t("storefront.partial.description")}
            </InlineAlert>
          </div>
          {content}
        </>
      }
    >
      {content}
    </AsyncState>
  );
}
