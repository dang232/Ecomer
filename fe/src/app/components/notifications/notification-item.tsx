import { useNavigate } from "react-router";

import type { Notification } from "../../types/api/notification";

import { NotificationIcon } from "./notification-icon";

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

interface NotificationItemProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
}

export function NotificationItem({ notification, onMarkRead }: NotificationItemProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (!notification.read) onMarkRead(notification.id);
    if (notification.deepLink) {
      void navigate(notification.deepLink);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`flex w-full gap-3 rounded-lg p-3 text-left transition-colors hover:bg-muted ${
        !notification.read ? "bg-[var(--primary)]/5" : ""
      }`}
    >
      <div className="mt-0.5 shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-muted">
        <NotificationIcon type={notification.type} size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="text-sm text-foreground line-clamp-1"
          style={{ fontWeight: !notification.read ? 600 : 400 }}
        >
          {notification.title}
        </p>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{notification.body}</p>
        <p className="text-[11px] text-muted-foreground mt-1">{relativeTime(notification.createdAt)}</p>
      </div>
      {!notification.read ? (
        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#FF6200]" />
      ) : null}
    </button>
  );
}
