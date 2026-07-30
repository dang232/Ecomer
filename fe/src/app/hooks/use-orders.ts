import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { cancelOrder, myOrders, orderById } from "@/shared/api/endpoints/orders";

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
    onSuccess: (_, id) => {
      // Prefix-invalidate all order list variants, then the specific detail.
      void qc.invalidateQueries({ queryKey: ["orders"] });
      void qc.invalidateQueries({ queryKey: orderDetailOptions(id).queryKey });
    },
  });
}
