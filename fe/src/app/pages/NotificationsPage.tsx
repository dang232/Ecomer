import {
  Bell,
  Truck,
  CheckCircle,
  Tag,
  CreditCard,
  MessageCircle,
  Settings,
  PlayCircle,
  XCircle,
} from "lucide-react";
import { Link, useNavigate } from "react-router";

import { useNotifications } from "../hooks/use-notifications";
import type { Notification, NotificationType } from "../types/api";

function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return new Date(then).toLocaleDateString("vi-VN");
}

type IconConfig = {
  icon: typeof Bell;
  bg: string;
  color: string;
};

const TYPE_ICON: Partial<Record<NotificationType, IconConfig>> & { default: IconConfig } = {
  ORDER_SHIPPED: { icon: Truck, bg: "bg-blue-100", color: "text-blue-600" },
  ORDER_DELIVERED: { icon: CheckCircle, bg: "bg-green-100", color: "text-green-600" },
  ORDER_CREATED: { icon: CheckCircle, bg: "bg-green-100", color: "text-green-600" },
  ORDER_CANCELLED: { icon: Bell, bg: "bg-red-100", color: "text-red-600" },
  PAYMENT_COMPLETED: { icon: CreditCard, bg: "bg-red-100", color: "text-red-600" },
  PAYMENT_REFUNDED: { icon: CreditCard, bg: "bg-amber-100", color: "text-amber-600" },
  REVIEW_REPLIED: { icon: MessageCircle, bg: "bg-purple-100", color: "text-purple-600" },
  SELLER_NEW_ORDER: { icon: Tag, bg: "bg-amber-100", color: "text-amber-600" },
  PRODUCT_APPROVED: { icon: CheckCircle, bg: "bg-green-100", color: "text-green-600" },
  PRODUCT_REJECTED: { icon: Bell, bg: "bg-red-100", color: "text-red-600" },
  RETURN_REQUESTED: { icon: Tag, bg: "bg-amber-100", color: "text-amber-600" },
  PAYOUT_COMPLETED: { icon: CreditCard, bg: "bg-green-100", color: "text-green-600" },
  // BA audit 2026-06-16 P2-9: distinct icons for video notifications
  VIDEO_PUBLISHED: { icon: PlayCircle, bg: "bg-green-100", color: "text-green-600" },
  VIDEO_REJECTED: { icon: XCircle, bg: "bg-red-100", color: "text-red-600" },
  default: { icon: Bell, bg: "bg-blue-100", color: "text-blue-600" },
};

function NotificationRow({
  notification,
  onMarkRead,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
}) {
  const navigate = useNavigate();
  const cfg = TYPE_ICON[notification.type] ?? TYPE_ICON.default;
  const Icon = cfg.icon;

  const handleClick = () => {
    if (!notification.read) onMarkRead(notification.id);
    if (notification.deepLink) void navigate(notification.deepLink);
  };

  return (
    <button
      onClick={handleClick}
      className={`flex gap-3 px-4 py-3.5 rounded-[var(--radius-md)] cursor-pointer transition-all hover:bg-background w-full text-left ${
        !notification.read ? "bg-primary-light" : ""
      }`}
    >
      {/* Icon circle */}
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.bg} ${cfg.color}`}
      >
        <Icon size={16} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-[13px] text-foreground line-clamp-1 ${!notification.read ? "font-semibold" : ""}`}
        >
          {notification.title}
        </p>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{notification.body}</p>
        <p className="text-[11px] text-muted-foreground mt-1">{relativeTime(notification.createdAt)}</p>
      </div>

      {/* Unread dot */}
      {!notification.read ? (
        <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
      ) : null}
    </button>
  );
}

export function NotificationsPageRoute() {
  const { items, unreadCount, isLoading, markRead, markAllRead } = useNotifications();

  return (
    <div className="max-w-[1100px] mx-auto py-8 px-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Bell size={22} className="text-foreground" />
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 ? (
            <button
              onClick={() => markAllRead()}
              className="text-sm font-medium text-primary hover:underline"
            >
              Mark all as read
            </button>
          ) : null}
          <Link
            to="/notifications/preferences"
            className="p-1.5 rounded-[var(--radius-md)] hover:bg-background transition-colors"
            aria-label="Notification settings"
          >
            <Settings size={18} className="text-muted-foreground" />
          </Link>
        </div>
      </div>
      <p className="text-sm text-text-secondary mb-6">
        {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}` : "You're all caught up"}
      </p>

      {/* List */}
      <div className="flex flex-col gap-0.5">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center bg-card rounded-[var(--radius-lg)] border border-border">
            <Bell size={48} className="mx-auto mb-4 text-gray-200" />
            <p className="text-muted-foreground font-medium">No notifications yet</p>
          </div>
        ) : (
          items.map((n) => (
            <NotificationRow key={n.id} notification={n} onMarkRead={markRead} />
          ))
        )}
      </div>
    </div>
  );
}
