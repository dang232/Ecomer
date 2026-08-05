import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useSearchParams } from "react-router"; // grouped with react

import { sellerPendingOrders } from "@/shared/api/endpoints/orders";

import { toSellerOrderRow } from "../model/order-queue-view";

import { OrderQueue } from "./order-queue";

export { OrderQueue } from "./order-queue";

export function SellerOrderQueueRoute() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const selected = searchParams.get("selected");

  const ordersQuery = useQuery({
    queryKey: ["seller", "orders", "queue", { q }],
    queryFn: () => sellerPendingOrders({ q: q || undefined }),
    retry: false,
  });

  const rows = useMemo(() => (ordersQuery.data ?? []).map(toSellerOrderRow), [ordersQuery.data]);

  const handleRouteChange = (next: { q?: string; selected?: string | null }) => {
    const params = new URLSearchParams(searchParams);
    if ("q" in next) {
      if (next.q !== undefined) {
        if (next.q) params.set("q", next.q);
        else params.delete("q");
      }
    }
    if ("selected" in next) {
      if (next.selected) params.set("selected", next.selected);
      else params.delete("selected");
    }
    setSearchParams(params, { replace: true });
  };

  return (
    <OrderQueue
      orders={rows}
      isLoading={ordersQuery.isLoading}
      error={ordersQuery.error}
      routeState={{ q, selected }}
      onRouteChange={handleRouteChange}
      onRetry={() => void ordersQuery.refetch()}
    />
  );
}
