import {
  IconArrowBack,
  IconBell,
  IconBuildingStore,
  IconCircleCheck,
  IconCircleX,
  IconCreditCard,
  IconMessage,
  IconPackage,
  IconPlayerPlay,
  IconPlayerStop,
  IconReceiptRefund,
  IconShoppingCart,
  IconTruck,
  IconWallet,
  IconX,
} from "@tabler/icons-react";

import type { NotificationType } from "../../types/api/notification";

const ICON_MAP: Record<NotificationType, typeof IconBell> = {
  ORDER_CREATED: IconShoppingCart,
  ORDER_CANCELLED: IconX,
  ORDER_SHIPPED: IconTruck,
  ORDER_DELIVERED: IconPackage,
  PAYMENT_COMPLETED: IconCreditCard,
  PAYMENT_REFUNDED: IconReceiptRefund,
  SELLER_NEW_ORDER: IconBuildingStore,
  PRODUCT_APPROVED: IconCircleCheck,
  PRODUCT_REJECTED: IconCircleX,
  REVIEW_REPLIED: IconMessage,
  RETURN_REQUESTED: IconArrowBack,
  PAYOUT_COMPLETED: IconWallet,
  VIDEO_PUBLISHED: IconPlayerPlay,
  VIDEO_REJECTED: IconPlayerStop,
};

const COLOR_MAP: Record<NotificationType, string> = {
  ORDER_CREATED: "text-blue-500",
  ORDER_CANCELLED: "text-red-500",
  ORDER_SHIPPED: "text-indigo-500",
  ORDER_DELIVERED: "text-green-600",
  PAYMENT_COMPLETED: "text-green-500",
  PAYMENT_REFUNDED: "text-amber-500",
  SELLER_NEW_ORDER: "text-blue-600",
  PRODUCT_APPROVED: "text-green-500",
  PRODUCT_REJECTED: "text-red-500",
  REVIEW_REPLIED: "text-purple-500",
  RETURN_REQUESTED: "text-orange-500",
  PAYOUT_COMPLETED: "text-emerald-500",
  VIDEO_PUBLISHED: "text-green-500",
  VIDEO_REJECTED: "text-red-500",
};

interface NotificationIconProps {
  type: NotificationType;
  size?: number;
}

export function NotificationIcon({ type, size = 16 }: NotificationIconProps) {
  const Icon = ICON_MAP[type] ?? IconBell;
  const colorClass = COLOR_MAP[type] ?? "text-muted-foreground";
  return <Icon size={size} className={colorClass} />;
}
