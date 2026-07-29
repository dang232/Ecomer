import {
  readRouteState,
  routeParam,
  type RouteState,
  writeRouteState,
} from "../../../shared/routing/route-state";

const sellerOrdersRouteSchema = {
  q: routeParam.string({ defaultValue: "", maxLength: 100 }),
  selected: routeParam.string({ defaultValue: "", maxLength: 100 }),
};

const sellerListRouteSchema = {
  q: routeParam.string({ defaultValue: "", maxLength: 100 }),
  page: routeParam.integer({ defaultValue: 1, min: 1, max: 10_000 }),
  selected: routeParam.string({ defaultValue: "", maxLength: 100 }),
};

export type SellerOrdersRouteState = RouteState<typeof sellerOrdersRouteSchema>;
export type SellerListRouteState = RouteState<typeof sellerListRouteSchema>;

export const readSellerOrdersRouteState = (
  source: string | URLSearchParams,
): SellerOrdersRouteState => readRouteState(source, sellerOrdersRouteSchema);

export const writeSellerOrdersRouteState = (
  source: string | URLSearchParams,
  updates: Partial<SellerOrdersRouteState>,
): URLSearchParams => writeRouteState(source, sellerOrdersRouteSchema, updates);

export const readSellerProductsRouteState = (
  source: string | URLSearchParams,
): SellerListRouteState => readRouteState(source, sellerListRouteSchema);

export const readSellerReviewsRouteState = (
  source: string | URLSearchParams,
): SellerListRouteState => readRouteState(source, sellerListRouteSchema);
