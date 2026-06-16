import { IconBell, IconSettings } from "@tabler/icons-react";
import { Link } from "react-router";

import { useNotifications } from "../../hooks/use-notifications";

import { NotificationFilters } from "./notification-filters";
import { NotificationThreadList } from "./notification-thread-list";

export function NotificationsPage() {
  const { markRead, markAllRead, unreadCount } = useNotifications();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <IconBell size={24} className="text-foreground" />
          <h1 className="text-xl font-semibold text-foreground">Thông báo</h1>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 ? (
            <button
              onClick={() => markAllRead()}
              className="text-sm font-medium hover:underline"
              style={{ color: "var(--primary)" }}
            >
              Đánh dấu tất cả đã đọc
            </button>
          ) : null}
          <Link
            to="/notifications/preferences"
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            aria-label="Cài đặt thông báo"
          >
            <IconSettings size={20} className="text-muted-foreground" />
          </Link>
        </div>
      </div>

      {/* Filters */}
      <NotificationFilters />

      {/* Thread list */}
      <div className="mt-4">
        <NotificationThreadList onMarkRead={markRead} />
      </div>
    </div>
  );
}
