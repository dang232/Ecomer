import { createQueryOptions } from "@tanstack/react-query";

import {
  sellerPendingOrders,
  sellerAcceptOrder,
  sellerRejectOrder,
  sellerShipOrder,
} from "@/shared/api/endpoints/orders";

export const sellerOrderKeys = {
  all: ["seller", "orders"] as const,
  queue: (params: { q?: string }) => [...sellerOrderKeys.all, "queue", params] as const,
};

export const sellerPendingOrdersOptions = (params: { q?: string }) =>
  /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */ createQueryOptions({
    queryKey: sellerOrderKeys.queue(params),
    queryFn: () => sellerPendingOrders(params),
  });

export const sellerAcceptOrderMutation = () => ({
  mutationFn: (subOrderId: string) => sellerAcceptOrder(subOrderId),
});

export const sellerRejectOrderMutation = () => ({
  mutationFn: (subOrderId: string) => sellerRejectOrder(subOrderId),
});

export const sellerShipOrderMutation = () => ({
  mutationFn: ({
    subOrderId,
    body,
  }: {
    subOrderId: string;
    body: { carrier: string; trackingNumber: string };
  }) => sellerShipOrder(subOrderId, body),
});
