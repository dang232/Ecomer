import { queryOptions } from "@tanstack/react-query";

import { sellerPendingOrders } from "../../../app/lib/api/endpoints/orders";

export type SellerOrdersParams = NonNullable<Parameters<typeof sellerPendingOrders>[0]>;

export const sellerKeys = {
  all: ["seller"] as const,
  orders: () => [...sellerKeys.all, "orders"] as const,
  orderList: (params: SellerOrdersParams) => [...sellerKeys.orders(), "list", params] as const,
};

export const sellerOrdersOptions = (params: SellerOrdersParams) =>
  queryOptions({
    queryKey: sellerKeys.orderList(params),
    queryFn: () => sellerPendingOrders(params),
    staleTime: 30_000,
  });
