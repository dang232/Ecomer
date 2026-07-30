import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  unreadNotificationCount,
} from "@/shared/api/endpoints/notifications";
import type { Notification } from "@/shared/contracts/api";

import { useAuth } from "./auth-context";

const NOTIFICATIONS_KEY = ["notifications", "list"] as const;
const UNREAD_KEY = ["notifications", "unread-count"] as const;

export function useNotifications() {
  const { ready, authenticated } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: () => listNotifications({ size: 30 }),
    enabled: ready && authenticated,
    refetchOnWindowFocus: true,
    retry: false,
  });

  const unreadCountQuery = useQuery({
    queryKey: UNREAD_KEY,
    queryFn: () => unreadNotificationCount(),
    enabled: ready && authenticated,
    refetchOnWindowFocus: true,
    retry: false,
  });

  const items: Notification[] = query.data?.content ?? [];

  const patchCacheAfterRead = (id: string, updated?: Notification) => {
    qc.setQueryData<typeof query.data>(NOTIFICATIONS_KEY, (prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        content: prev.content.map((n) =>
          n.id === id ? { ...n, ...(updated ?? {}), read: true } : n,
        ),
      };
    });
  };

  /**
   * Optimistically mark a notification as read, then call the server. On failure
   * we roll back so the bell count stays accurate.
   */
  const markRead = useMutation<
    Notification,
    unknown,
    string,
    { previous?: typeof query.data; previousUnread?: { count: number } }
  >({
    mutationFn: (id: string) => markNotificationRead(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: NOTIFICATIONS_KEY });
      await qc.cancelQueries({ queryKey: UNREAD_KEY });
      const previous = qc.getQueryData<typeof query.data>(NOTIFICATIONS_KEY);
      const previousUnread = qc.getQueryData<{ count: number }>(UNREAD_KEY);
      const wasUnread = previous?.content.some((n) => n.id === id && n.read === false) ?? false;
      patchCacheAfterRead(id);
      if (wasUnread && previousUnread) {
        qc.setQueryData<{ count: number }>(UNREAD_KEY, {
          ...previousUnread,
          count: Math.max(0, previousUnread.count - 1),
        });
      }
      return { previous, previousUnread };
    },
    onSuccess: (updated, id) => {
      patchCacheAfterRead(id, updated);
    },
    onError: (_err, _id, context) => {
      if (context?.previous) qc.setQueryData(NOTIFICATIONS_KEY, context.previous);
      if (context?.previousUnread) qc.setQueryData(UNREAD_KEY, context.previousUnread);
    },
  });

  const markAllRead = useMutation<
    { updated: number },
    unknown,
    void,
    { previous?: typeof query.data; previousUnread?: { count: number } }
  >({
    mutationFn: () => markAllNotificationsRead(),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: NOTIFICATIONS_KEY });
      await qc.cancelQueries({ queryKey: UNREAD_KEY });
      const previous = qc.getQueryData<typeof query.data>(NOTIFICATIONS_KEY);
      const previousUnread = qc.getQueryData<{ count: number }>(UNREAD_KEY);
      qc.setQueryData<typeof query.data>(NOTIFICATIONS_KEY, (prev) => {
        if (!prev) return prev;
        return { ...prev, content: prev.content.map((n) => ({ ...n, read: true })) };
      });
      qc.setQueryData<{ count: number }>(UNREAD_KEY, { count: 0 });
      return { previous, previousUnread };
    },
    onError: (_err, _v, context) => {
      if (context?.previous) qc.setQueryData(NOTIFICATIONS_KEY, context.previous);
      if (context?.previousUnread) qc.setQueryData(UNREAD_KEY, context.previousUnread);
    },
  });

  const unreadCount = unreadCountQuery.data?.count ?? items.filter((n) => n.read === false).length;

  return {
    items,
    unreadCount,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    markRead: markRead.mutate,
    markAllRead: markAllRead.mutate,
  };
}
