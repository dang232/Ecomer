import { toast } from "sonner";

import type { Notification } from "../types/api/notification";

import { NotificationIcon } from "./notifications/notification-icon";

interface NotificationToastProps {
  notification: Notification;
  toastId: string | number;
  onNavigate: (path: string) => void;
}

export function NotificationToast({ notification, toastId, onNavigate }: NotificationToastProps) {
  const handleClick = () => {
    toast.dismiss(toastId);
    if (notification.deepLink) {
      onNavigate(notification.deepLink);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="flex w-full max-w-sm gap-3 rounded-lg bg-card p-3 shadow-lg border border-border text-left hover:bg-muted transition-colors cursor-pointer"
    >
      <div className="mt-0.5 shrink-0">
        <NotificationIcon type={notification.type} size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{notification.title}</p>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{notification.body}</p>
      </div>
    </button>
  );
}
