import { queryOptions } from "@tanstack/react-query";

import { adminListOrders } from "@/shared/api/endpoints/admin";

export type AdminOrderListParams = NonNullable<Parameters<typeof adminListOrders>[0]>;

export const adminKeys = {
  all: ["admin"] as const,
  orders: () => [...adminKeys.all, "orders"] as const,
  orderList: (params: AdminOrderListParams) => [...adminKeys.orders(), "list", params] as const,
};

export const adminOrdersOptions = (params: AdminOrderListParams) =>
  queryOptions({
    queryKey: adminKeys.orderList(params),
    queryFn: () => adminListOrders(params),
    staleTime: 30_000,
  });
