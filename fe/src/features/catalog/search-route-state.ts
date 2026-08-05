import {
  readRouteState,
  routeParam,
  type RouteState,
  writeRouteState,
} from "../../shared/routing/route-state";

export const searchSortValues = ["popular", "price-low", "price-high", "newest"] as const;

export const searchRouteSchema = {
  q: routeParam.string({ defaultValue: "", maxLength: 120 }),
  cat: routeParam.string({ defaultValue: "", maxLength: 100 }),
  brand: routeParam.string({ defaultValue: "", maxLength: 100 }),
  priceMin: routeParam.string({ defaultValue: "", maxLength: 16 }),
  priceMax: routeParam.string({ defaultValue: "", maxLength: 16 }),
  minRating: routeParam.integer({ defaultValue: 0, min: 0, max: 5 }),
  tag: routeParam.stringList(),
  sameDay: routeParam.boolean(false),
  verifiedOnly: routeParam.boolean(false),
  officialOnly: routeParam.boolean(false),
  sort: routeParam.enum(searchSortValues, "popular"),
  page: routeParam.integer({ defaultValue: 1, min: 1, max: 10_000 }),
  flash: routeParam.boolean(false),
};

export type SearchRouteState = RouteState<typeof searchRouteSchema>;

export function readSearchRouteState(source: URLSearchParams | string): SearchRouteState {
  const state = readRouteState(source, searchRouteSchema);
  return state;
}

export function updateSearchRouteState(
  source: URLSearchParams | string,
  updates: Partial<SearchRouteState>,
  { resetPage = true }: { resetPage?: boolean } = {},
): URLSearchParams {
  const next = writeRouteState(source, searchRouteSchema, updates);
  return resetPage ? writeRouteState(next, searchRouteSchema, { page: 1 }) : next;
}

export function clearSearchFilters(source: URLSearchParams | string): URLSearchParams {
  const current = readSearchRouteState(source);
  return writeRouteState(new URLSearchParams(), searchRouteSchema, {
    q: current.q,
    flash: current.flash,
  });
}
