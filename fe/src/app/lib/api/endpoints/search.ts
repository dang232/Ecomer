import { z } from "zod";

import {
  pageSchema,
  productSummarySchema,
  searchFacetsSchema,
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
  sort?: string;
  page?: number;
  size?: number;
  sameDay?: boolean;
  verifiedOnly?: boolean;
  officialOnly?: boolean;
}

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
      sort: params.sort,
      page: params.page,
      size: params.size ?? 24,
      sameDay: params.sameDay,
      verifiedOnly: params.verifiedOnly,
      officialOnly: params.officialOnly,
    },
    { auth: false },
  );

/**
 * Aggregated category + brand counts for a search. Each axis drops its own
 * filter (so the sidebar shows what other categories/brands match the rest of
 * the query) but keeps q + price + the OTHER axis applied.
 */
export const searchFacets = (
  params: Pick<SearchParams, "q" | "category" | "brand" | "minPrice" | "maxPrice" | "sameDay" | "verifiedOnly" | "officialOnly">,
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
      sameDay: params.sameDay,
      verifiedOnly: params.verifiedOnly,
      officialOnly: params.officialOnly,
    },
    { auth: false },
  );

/** Up to 10 product-name prefix matches for the header autocomplete. */
export const searchSuggestions = (q: string) =>
  api.get("/search/suggest", z.array(z.string()), { q }, { auth: false });
