import type { TrustCue } from "@/shared/commerce";

export interface ProductVariantSource {
  sku?: string;
  name?: string;
  priceAmount?: number;
  imageUrl?: string;
  stockQuantity?: number;
}

export interface ProductDetailSource {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image?: string;
  images: readonly string[];
  rating?: number;
  sold?: number;
  stock: number;
  sellerId?: string;
  variants?: readonly ProductVariantSource[];
}

export interface PublicSellerSource {
  id: string;
  shopName: string;
  ratingAvg?: number | null;
}

export type ProductSellerInput =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "ready"; value: PublicSellerSource };

export interface ProductDetailView {
  id: string;
  title: string;
  media: readonly { id: string; url: string; alt: string }[];
  priceVnd: number;
  originalPriceVnd?: number;
  rating?: number;
  soldCount?: number;
  stockState: "in-stock" | "low-stock" | "unavailable";
  variants: readonly { sku: string; label: string; available: boolean }[];
  selectedVariant?: { sku: string; stock: number };
  seller:
    | { status: "loading" }
    | { status: "unavailable" }
    | { status: "ready"; id: string; name: string; rating?: number };
  trustCues: readonly TrustCue[];
  actions: { addToCart: boolean; buyNow: boolean };
}

export interface ProductDetailInput {
  product: ProductDetailSource;
  seller?: ProductSellerInput;
  selectedVariant: string | null;
}

function stockState(stock: number): ProductDetailView["stockState"] {
  if (stock <= 0) return "unavailable";
  return stock <= 5 ? "low-stock" : "in-stock";
}

function resolveSeller(
  product: ProductDetailSource,
  seller: ProductSellerInput | undefined,
): ProductDetailView["seller"] {
  if (!seller) return product.sellerId ? { status: "loading" } : { status: "unavailable" };
  if (seller.status !== "ready") return seller;
  return {
    status: "ready",
    id: seller.value.id,
    name: seller.value.shopName,
    rating: seller.value.ratingAvg ?? undefined,
  };
}

export function toProductDetailView(input: ProductDetailInput): ProductDetailView {
  const selected = input.selectedVariant
    ? input.product.variants?.find((variant) => variant.sku === input.selectedVariant)
    : undefined;
  const resolvedStock = selected?.stockQuantity ?? input.product.stock;
  const mediaUrls = Array.from(
    new Set([...input.product.images, input.product.image ?? ""].filter(Boolean)),
  );

  return {
    id: input.product.id,
    title: input.product.name,
    media: mediaUrls.map((url, index) => ({
      id: `${input.product.id}-${index}`,
      url,
      alt: input.product.name,
    })),
    priceVnd: selected?.priceAmount ?? input.product.price,
    originalPriceVnd: input.product.originalPrice,
    rating: input.product.rating,
    soldCount: input.product.sold,
    stockState: stockState(resolvedStock),
    variants: (input.product.variants ?? [])
      .filter((variant): variant is ProductVariantSource & { sku: string } => Boolean(variant.sku))
      .map((variant) => ({
        sku: variant.sku,
        label: variant.name?.trim() || variant.sku,
        available: (variant.stockQuantity ?? input.product.stock) > 0,
      })),
    selectedVariant: selected?.sku
      ? { sku: selected.sku, stock: selected.stockQuantity ?? input.product.stock }
      : undefined,
    seller: resolveSeller(input.product, input.seller),
    trustCues: [
      { id: "buyer-protection", label: "Buyer protection" },
      { id: "returns", label: "Easy returns" },
      { id: "shipping", label: "Tracked delivery" },
    ],
    actions: {
      addToCart: resolvedStock > 0,
      buyNow: resolvedStock > 0,
    },
  };
}
