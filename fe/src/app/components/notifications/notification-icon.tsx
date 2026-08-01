import {
  ArrowLeft,
  Bell,
  Store,
  CheckCircle2,
  XCircle,
  CreditCard,
  MessageSquare,
  Package,
  Play,
  Square,
  Receipt,
  ShoppingCart,
  Truck,
  Wallet,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { NotificationType } from "@/shared/contracts/api/notification";

const ICON_MAP: Record<NotificationType, LucideIcon> = {
  ORDER_CREATED: ShoppingCart,
  ORDER_CANCELLED: X,
  ORDER_SHIPPED: Truck,
  ORDER_DELIVERED: Package,
  PAYMENT_COMPLETED: CreditCard,
  PAYMENT_REFUNDED: Receipt,
  SELLER_NEW_ORDER: Store,
  PRODUCT_APPROVED: CheckCircle2,
  PRODUCT_REJECTED: XCircle,
  REVIEW_REPLIED: MessageSquare,
  RETURN_REQUESTED: ArrowLeft,
  PAYOUT_COMPLETED: Wallet,
  VIDEO_PUBLISHED: Play,
  VIDEO_REJECTED: Square,
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
  const Icon = ICON_MAP[type] ?? Bell;
  const colorClass = COLOR_MAP[type] ?? "text-muted-foreground";
  return <Icon size={size} className={colorClass} />;
}
