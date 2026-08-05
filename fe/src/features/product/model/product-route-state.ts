import {
  readRouteState,
  routeParam,
  type RouteState,
  writeRouteState,
} from "@/shared/routing/route-state";

export const productSectionValues = ["details", "reviews", "questions", "videos"] as const;

export const productRouteSchema = {
  section: routeParam.enum(productSectionValues, "details"),
  variant: routeParam.string({ defaultValue: "", maxLength: 100 }),
};

export type ProductRouteState = RouteState<typeof productRouteSchema>;

export function readProductRouteState(source: URLSearchParams | string): ProductRouteState {
  return readRouteState(source, productRouteSchema);
}

export function updateProductRouteState(
  source: URLSearchParams | string,
  updates: Partial<ProductRouteState>,
): URLSearchParams {
  return writeRouteState(source, productRouteSchema, updates);
}
