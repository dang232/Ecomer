import { IconInbox } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";

import { listThreads } from "../../lib/api/endpoints/notifications";

import { NotificationPagination } from "./notification-pagination";
import { NotificationThread } from "./notification-thread";

interface NotificationThreadListProps {
  onMarkRead: (id: string) => void;
}

export function NotificationThreadList({ onMarkRead }: NotificationThreadListProps) {
  const [params] = useSearchParams();
  const type = params.get("type") ?? undefined;
  const page = parseInt(params.get("page") ?? "0", 10);

  const { data, isLoading } = useQuery({
    queryKey: ["notifications", "threads", { type, page }],
    queryFn: () => listThreads({ type, page, size: 20 }),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={`notification-thread-skeleton-${i}`}
            className="h-14 rounded-xl bg-muted animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!data || data.content.length === 0) {
    return (
      <div className="py-12 text-center">
        <IconInbox size={40} className="mx-auto mb-3 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Không có thông báo nào</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {data.content.map((thread) => (
        <NotificationThread key={thread.threadId} thread={thread} onMarkRead={onMarkRead} />
      ))}
      <NotificationPagination totalPages={data.totalPages ?? 0} currentPage={data.number ?? 0} />
    </div>
  );
}
