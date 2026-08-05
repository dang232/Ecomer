import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { cancelOrder, myOrders, orderById } from "@/shared/api/endpoints/orders";
import type { Order, Page } from "@/shared/contracts/api";

export const myOrdersOptions = (params: { page?: number; size?: number; status?: string } = {}) =>
  queryOptions({
    queryKey: ["orders", params] as const,
    queryFn: () => myOrders(params),
  });

export const orderDetailOptions = (id: string | undefined) =>
  queryOptions({
    queryKey: ["orders", "detail", id] as const,
    queryFn: () => {
      if (!id) throw new Error("An order ID is required");
      return orderById(id);
    },
    enabled: !!id,
  });

export function useMyOrders(params: { page?: number; size?: number; status?: string } = {}) {
  return useQuery(myOrdersOptions(params));
}

export function useOrder(id: string | undefined) {
  return useQuery(orderDetailOptions(id));
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelOrder(id),
    onSuccess: (cancelledOrder, id) => {
      qc.setQueriesData<Page<Order>>(
        {
          queryKey: ["orders"],
          predicate: (query) => query.queryKey[1] !== "detail",
        },
        (page) => {
          if (!page) return page;

          return {
            ...page,
            content: page.content.map((order) =>
              order.id === cancelledOrder.id ? cancelledOrder : order,
            ),
          };
        },
      );
      qc.setQueryData<Order>(orderDetailOptions(id).queryKey, cancelledOrder);

      // The cancel response is authoritative, while GET /orders reads an
      // asynchronously projected summary. Mark both caches stale for a later
      // refresh without immediately refetching the projection and overwriting
      // the confirmed cancellation with an older row.
      void qc.invalidateQueries({ queryKey: ["orders"], refetchType: "none" });
      void qc.invalidateQueries({
        queryKey: orderDetailOptions(id).queryKey,
        refetchType: "none",
      });
    },
  });
}
