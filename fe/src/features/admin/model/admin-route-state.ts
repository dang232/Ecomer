import {
  readRouteState,
  routeParam,
  type RouteState,
  writeRouteState,
} from "../../../shared/routing/route-state";

const adminOrdersRouteSchema = {
  page: routeParam.integer({ defaultValue: 1, min: 1, max: 10_000 }),
  q: routeParam.string({ defaultValue: "", maxLength: 100 }),
  status: routeParam.enum(
    ["all", "PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] as const,
    "all",
  ),
  selected: routeParam.string({ defaultValue: "", maxLength: 100 }),
};

export type AdminOrdersRouteState = RouteState<typeof adminOrdersRouteSchema>;

export const readAdminOrdersRouteState = (
  source: string | URLSearchParams,
): AdminOrdersRouteState => readRouteState(source, adminOrdersRouteSchema);

export const writeAdminOrdersRouteState = (
  source: string | URLSearchParams,
  updates: Partial<AdminOrdersRouteState>,
): URLSearchParams => writeRouteState(source, adminOrdersRouteSchema, updates);
