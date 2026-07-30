import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { getThreadNotifications } from "@/shared/api/endpoints/notifications";
import type { NotificationThread as ThreadType } from "@/shared/contracts/api/notification";

import { NotificationItem } from "./notification-item";

interface NotificationThreadProps {
  thread: ThreadType;
  onMarkRead: (id: string) => void;
}

export function NotificationThread({ thread, onMarkRead }: NotificationThreadProps) {
  const [expanded, setExpanded] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ["notifications", "thread", thread.threadId],
    queryFn: () => getThreadNotifications(thread.threadId),
    enabled: expanded,
  });

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-muted transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
          <span className="text-sm font-medium text-foreground">{thread.threadTitle}</span>
          {thread.unreadCount > 0 ? (
            <span className="rounded-full bg-error text-white px-1.5 py-0.5 text-[10px] font-bold text-white">
              {thread.unreadCount}
            </span>
          ) : null}
        </div>
        <span className="text-xs text-muted-foreground">{thread.totalCount} thông báo</span>
      </button>
      {expanded && items.length > 0 ? (
        <div className="border-t border-border divide-y divide-border">
          {items.map((n) => (
            <NotificationItem key={n.id} notification={n} onMarkRead={onMarkRead} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
