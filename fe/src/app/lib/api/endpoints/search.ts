import { z } from "zod";

import {
  pageSchema,
  productSummarySchema,
  searchFacetsSchema,
  searchV2Schema,
  type SearchFacets,
} from "../../../types/api";
import { api } from "../client";

export type { SearchFacets };
export { searchFacetsSchema };

export interface SearchParams {
  q?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  tags?: string[];
  sort?: string;
  page?: number;
  size?: number;
  sameDay?: boolean;
  verifiedOnly?: boolean;
  officialOnly?: boolean;
}

/** @deprecated Use searchProductsV2 for all buyer catalog reads. */
export const searchProducts = (params: SearchParams) =>
  api.get(
    "/search",
    pageSchema(productSummarySchema),
    {
      q: params.q,
      category: params.category,
      brand: params.brand,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      minRating: params.minRating,
      tag: params.tags,
      sort: params.sort,
      page: params.page,
      size: params.size ?? 24,
      sameDay: params.sameDay,
      verifiedOnly: params.verifiedOnly,
      officialOnly: params.officialOnly,
    },
    { auth: false },
  );

export interface CursorSearchParams extends Omit<SearchParams, "page" | "size"> {
  cursor?: string;
  limit?: number;
  includeFacets?: boolean;
}

/** Default cursor search. The result keeps response metadata for cache/cursor-aware callers. */
export const searchProductsV2 = (params: CursorSearchParams, signal?: AbortSignal) =>
  api.getWithMeta(
    "/search/v2",
    searchV2Schema,
    {
      q: params.q,
      category: params.category,
      brand: params.brand,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      minRating: params.minRating,
      tag: params.tags,
      sort: params.sort,
      sameDay: params.sameDay,
      verifiedOnly: params.verifiedOnly,
      officialOnly: params.officialOnly,
      cursor: params.cursor,
      limit: params.limit ?? 24,
      includeFacets: params.includeFacets,
    },
    { auth: false, signal },
  );

/**
 * Aggregated category + brand counts for a search. Each axis drops its own
 * filter (so the sidebar shows what other categories/brands match the rest of
 * the query) but keeps q + price + the OTHER axis applied.
 */
export const searchFacets = (
  params: Pick<
    SearchParams,
    | "q"
    | "category"
    | "brand"
    | "minPrice"
    | "maxPrice"
    | "minRating"
    | "tags"
    | "sameDay"
    | "verifiedOnly"
    | "officialOnly"
  >,
) =>
  api.get(
    "/search/facets",
    searchFacetsSchema,
    {
      q: params.q,
      category: params.category,
      brand: params.brand,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      minRating: params.minRating,
      tag: params.tags,
      sameDay: params.sameDay,
      verifiedOnly: params.verifiedOnly,
      officialOnly: params.officialOnly,
    },
    { auth: false },
  );

/** Up to 10 product-name prefix matches for the header autocomplete. */
export const searchSuggestions = (q: string) =>
  api.get("/search/suggest", z.array(z.string()), { q }, { auth: false });
