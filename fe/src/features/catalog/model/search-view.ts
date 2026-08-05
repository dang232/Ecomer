import type { ProductTileView } from "@/shared/commerce";

export interface SearchProductSource {
  id: string;
  name: string;
  image?: string;
  price: number;
  originalPrice?: number;
  rating?: number;
  sold?: number;
  sellerName?: string;
  stock?: number;
}

export interface SearchResultsInput {
  query: string;
  source: "primary" | "fallback";
  products: readonly SearchProductSource[];
  total: number;
  error: Error | null;
}

export interface SearchResultsView {
  status: "loading" | "empty" | "error" | "partial" | "ready";
  source: "primary" | "fallback";
  query: string;
  resultCount: number;
  products: readonly ProductTileView[];
  errorMessage?: string;
}

function toProductTileView(product: SearchProductSource): ProductTileView {
  const stock = product.stock;
  return {
    id: product.id,
    name: product.name,
    imageUrl: product.image?.trim() || undefined,
    priceVnd: product.price,
    originalPriceVnd: product.originalPrice,
    rating: product.rating,
    soldCount: product.sold,
    sellerName: product.sellerName?.trim() || undefined,
    stockState:
      stock === undefined || stock > 5 ? "in-stock" : stock > 0 ? "low-stock" : "unavailable",
  };
}

export function toSearchResultsView(input: SearchResultsInput): SearchResultsView {
  if (input.error) {
    return {
      status: "error",
      source: input.source,
      query: input.query,
      resultCount: 0,
      products: [],
      errorMessage: input.error.message,
    };
  }

  const products = input.products.map(toProductTileView);
  if (products.length === 0) {
    return {
      status: "empty",
      source: input.source,
      query: input.query,
      resultCount: input.total,
      products,
    };
  }

  return {
    status: input.source === "fallback" ? "partial" : "ready",
    source: input.source,
    query: input.query,
    resultCount: input.total,
    products,
  };
}
