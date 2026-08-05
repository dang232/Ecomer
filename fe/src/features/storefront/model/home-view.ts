import type { ProductTileView } from "@/shared/commerce";

export interface HomeProductSource {
  id: string;
  name: string;
  image?: string;
  price: number;
  originalPrice?: number;
  rating?: number;
  sold?: number;
  sellerName?: string;
  stock?: number;
  stockState?: ProductTileView["stockState"];
}

export interface HomeCategorySource {
  id: string;
  name?: string;
  label?: string;
}

export interface HomeSellerSource {
  id: string;
  shopName: string;
  tier?: string;
  joinedAt?: string;
  ratingAvg?: number | null;
  ratingCount?: number;
  totalProducts?: number;
}

export interface HomeMarketplaceInput {
  categories: readonly HomeCategorySource[];
  flashProducts: readonly HomeProductSource[];
  sellers: readonly HomeSellerSource[];
  recommendations: readonly HomeProductSource[];
  recentlyViewed: readonly HomeProductSource[];
}

export interface HomeMarketplaceView {
  campaign: null | {
    title: string;
    imageUrl: string;
    href: string;
    priceVnd: number;
  };
  shortcuts: readonly {
    id: "vouchers" | "shipping" | "mall" | "video" | "delivery";
    labelKey: string;
    href: string;
  }[];
  categories: readonly { id: string; label: string; href: string }[];
  flashSale: readonly ProductTileView[];
  featuredSellers: readonly { id: string; name: string; rating?: number; href: string }[];
  liveCommerce: readonly { id: string; title: string; thumbnailUrl: string; href: string }[];
  recommendations: readonly ProductTileView[];
  recentlyViewed: readonly ProductTileView[];
  sections: Record<
    "categories" | "flashSale" | "featuredSellers" | "recommendations" | "recentlyViewed",
    "empty" | "ready"
  >;
}

const shortcuts: HomeMarketplaceView["shortcuts"] = [
  { id: "vouchers", labelKey: "storefront.shortcuts.vouchers", href: "/search" },
  { id: "shipping", labelKey: "storefront.shortcuts.shipping", href: "/search?sameDay=true" },
  { id: "mall", labelKey: "storefront.shortcuts.mall", href: "/search?officialOnly=true" },
  { id: "video", labelKey: "storefront.shortcuts.video", href: "/search" },
  { id: "delivery", labelKey: "storefront.shortcuts.delivery", href: "/search?sameDay=true" },
];

export function toProductTileView(product: HomeProductSource): ProductTileView {
  const stockState =
    product.stockState ??
    (product.stock !== undefined
      ? product.stock <= 0
        ? "unavailable"
        : product.stock <= 5
          ? "low-stock"
          : "in-stock"
      : "in-stock");

  return {
    id: product.id,
    name: product.name,
    imageUrl: product.image?.trim() || undefined,
    priceVnd: product.price,
    originalPriceVnd: product.originalPrice,
    rating: product.rating,
    soldCount: product.sold,
    sellerName: product.sellerName?.trim() || undefined,
    stockState,
  };
}

export function toHomeMarketplaceView(input: HomeMarketplaceInput): HomeMarketplaceView {
  const campaignSource = input.flashProducts.find((product) => Boolean(product.image?.trim()));
  const flashSale = input.flashProducts.map(toProductTileView);
  const recommendations = input.recommendations.map(toProductTileView);
  const recentlyViewed = input.recentlyViewed.map(toProductTileView);
  const categories = input.categories.map((category) => ({
    id: category.id,
    label: category.name?.trim() || category.label?.trim() || category.id,
    href: `/search?cat=${encodeURIComponent(category.id)}`,
  }));
  const featuredSellers = input.sellers.map((seller) => ({
    id: seller.id,
    name: seller.shopName,
    rating: seller.ratingAvg ?? undefined,
    href: `/sellers/${encodeURIComponent(seller.id)}`,
  }));

  return {
    campaign: campaignSource
      ? {
          title: campaignSource.name,
          imageUrl: campaignSource.image?.trim() ?? "",
          href: `/product/${encodeURIComponent(campaignSource.id)}`,
          priceVnd: campaignSource.price,
        }
      : null,
    shortcuts,
    categories,
    flashSale,
    featuredSellers,
    // Home has no decoded video feed endpoint yet, so we do not invent one.
    liveCommerce: [],
    recommendations,
    recentlyViewed,
    sections: {
      categories: categories.length > 0 ? "ready" : "empty",
      flashSale: flashSale.length > 0 ? "ready" : "empty",
      featuredSellers: featuredSellers.length > 0 ? "ready" : "empty",
      recommendations: recommendations.length > 0 ? "ready" : "empty",
      recentlyViewed: recentlyViewed.length > 0 ? "ready" : "empty",
    },
  };
}
