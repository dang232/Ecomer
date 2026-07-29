import { toast } from "sonner";

import type { Notification } from "../types/api/notification";

import { NotificationToast } from "./notification-toast";

export function showNotificationToast(
  notification: Notification,
  navigate: (path: string) => void,
): void {
  toast.custom(
    (id) => <NotificationToast notification={notification} toastId={id} onNavigate={navigate} />,
    { duration: 5000, position: "top-right" },
  );
}
