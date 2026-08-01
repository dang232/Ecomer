import type { Order, OrderDetail, OrderListItem, SubOrder } from "@/shared/contracts/api";
import type { OrderStatusUi } from "@/shared/contracts";

export type OrderAction = "cancel" | "request-return" | "buy-again";

export interface OrderTimelineEntry {
  id: "placed" | "current";
  labelKey: string;
  occurredAt?: string;
  current: boolean;
}

export interface OrderViewItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  totalVnd: number;
  imageUrl?: string;
  unitPriceVnd: number;
  variantId?: string;
}

export interface OrderSellerGroupView {
  sellerId: string;
  sellerName?: string;
  subOrderId: string;
  items: readonly OrderViewItem[];
}

export interface OrderView {
  id: string;
  orderNumber?: string;
  placedAt?: string;
  status: OrderStatusUi;
  sellerGroups: readonly OrderSellerGroupView[];
  financial: {
    subtotalVnd: number;
    shippingVnd: number;
    discountVnd: number;
    totalVnd: number;
  };
  timeline: readonly OrderTimelineEntry[];
  actions: readonly OrderAction[];
  paymentMethod?: string;
  paymentStatus?: string;
  trackingCode?: string | null;
  carrier?: string | null;
}

interface ToOrderViewInput {
  detail: Order | OrderDetail;
  summary?: Order | OrderListItem;
}

function toGroupItems(subOrder: SubOrder): OrderViewItem[] {
  return (subOrder.items ?? []).map((item) => ({
    id: `${subOrder.id}:${item.productId}:${item.variantId ?? ""}`,
    productId: item.productId,
    name: item.name ?? item.productId,
    quantity: item.quantity,
    totalVnd: item.price * item.quantity,
    imageUrl: item.image ?? undefined,
    unitPriceVnd: item.price,
    variantId: item.variantId ?? undefined,
  }));
}

function toTimeline(status: OrderStatusUi, placedAt?: string): OrderTimelineEntry[] {
  if (!placedAt) {
    return [
      {
        id: "current",
        labelKey: `orders.status.${status}`,
        occurredAt: undefined,
        current: true,
      },
    ];
  }

  return [
    {
      id: "placed",
      labelKey: "orders.timeline.placed",
      occurredAt: placedAt,
      current: false,
    },
    {
      id: "current",
      labelKey: `orders.status.${status}`,
      occurredAt: undefined,
      current: true,
    },
  ];
}

function toActions(status: OrderStatusUi): OrderAction[] {
  if (status === "pending") return ["cancel"];
  if (status === "delivered") return ["request-return", "buy-again"];
  return [];
}

export function toOrderView({ detail, summary }: ToOrderViewInput): OrderView {
  const sellerGroups = (detail.subOrders ?? []).map((subOrder) => ({
    sellerId: subOrder.sellerId ?? "seller-unavailable",
    sellerName: subOrder.sellerName?.trim() || undefined,
    subOrderId: subOrder.id,
    items: toGroupItems(subOrder),
  }));
  const placedAt = summary?.id === detail.id ? summary.createdAt : undefined;

  return {
    id: detail.id,
    orderNumber: detail.orderNumber,
    placedAt,
    status: detail.status,
    sellerGroups,
    financial: {
      subtotalVnd: detail.subtotal,
      shippingVnd: detail.shippingFee ?? 0,
      discountVnd: detail.discount ?? 0,
      totalVnd: detail.total,
    },
    timeline: toTimeline(detail.status, placedAt),
    actions: toActions(detail.status),
    paymentMethod: detail.paymentMethod,
    paymentStatus: detail.paymentStatus,
    trackingCode: detail.trackingCode,
    carrier: detail.carrier,
  };
}
