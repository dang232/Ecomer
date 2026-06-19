import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";

import { showNotificationToast } from "../components/notification-toast";
import { notificationSchema, type Notification } from "../types/api/notification";

import { useAuth } from "./use-auth";

const BASE_URL = (
  (import.meta.env as Record<string, string | undefined>).VITE_API_URL ?? "http://localhost:8080"
).replace(/\/$/, "");

const RECONNECT_BASE_MS = 2000;
const RECONNECT_CAP_MS = 30_000;
const MAX_RECONNECT_ATTEMPTS = 5;
const FALLBACK_RETRY_MS = 60_000;

const NOTIFICATIONS_KEY = ["notifications", "list"] as const;
const UNREAD_KEY = ["notifications", "unread-count"] as const;
const NOTIFICATION_THREADS_KEY = ["notifications", "threads"] as const;

interface CachedNotificationPage {
  content?: Notification[];
  items?: Notification[];
}

interface CachedUnreadCount {
  count: number;
}

/**
 * Real-time notification delivery via socket.io.
 * Connects to /ws/notifications namespace with JWT auth.
 * On new notification: updates query cache + fires toast.
 * On catch-up (reconnect): merges missed notifications into cache.
 * Reconnects with exponential backoff capped at 30s.
 * After 5 fast retries, falls back to 60s interval indefinitely.
 */
export function useNotificationSocket(): void {
  const { ready, authenticated, token } = useAuth();
  const qc = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const attemptRef = useRef(0);
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (!ready || !authenticated || !token) return;
    stoppedRef.current = false;

    const connect = () => {
      if (stoppedRef.current) return;

      // Clean up previous socket if exists
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      const socket = io(BASE_URL, {
        path: "/ws/notifications",
        auth: { token },
        transports: ["websocket"],
        reconnection: false, // We handle reconnection manually
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        attemptRef.current = 0;
      });

      socket.on("notification:new", (raw: unknown) => {
        const result = notificationSchema.safeParse(raw);
        if (!result.success) return;
        const notification = result.data;

        // ACK delivery to server
        socket.emit("notification:ack", { ids: [notification.id] });

        // Update notifications list cache
        qc.setQueryData<CachedNotificationPage>(NOTIFICATIONS_KEY, (prev) => {
          if (!prev) return prev;
          const content = prev.content ?? prev.items ?? [];
          if (content.some((n) => n.id === notification.id)) return prev;
          return { ...prev, content: [notification, ...content] };
        });

        // Increment unread count
        qc.setQueryData<CachedUnreadCount>(UNREAD_KEY, (prev) => {
          if (!prev) return { count: 1 };
          return { ...prev, count: prev.count + 1 };
        });

        // Invalidate threads (will refetch on next access)
        void qc.invalidateQueries({ queryKey: NOTIFICATION_THREADS_KEY });

        // Fire toast
        showNotificationToast(notification, (path) => {
          window.location.href = path;
        });
      });

      socket.on("notification:catch-up", (raws: unknown[]) => {
        if (!Array.isArray(raws)) return;
        const notifications = raws.flatMap((r) => {
          const result = notificationSchema.safeParse(r);
          return result.success ? [result.data] : [];
        });

        if (notifications.length === 0) return;

        // ACK delivery for all catch-up notifications
        socket.emit("notification:ack", { ids: notifications.map((n) => n.id) });

        // Merge into cache
        qc.setQueryData<CachedNotificationPage>(NOTIFICATIONS_KEY, (prev) => {
          if (!prev) return prev;
          const content = prev.content ?? prev.items ?? [];
          const existingIds = new Set(content.map((n) => n.id));
          const fresh = notifications.filter((n) => !existingIds.has(n.id));
          if (fresh.length === 0) return prev;
          return { ...prev, content: [...fresh, ...content] };
        });

        // Refresh unread count
        void qc.invalidateQueries({ queryKey: UNREAD_KEY });
        void qc.invalidateQueries({ queryKey: NOTIFICATION_THREADS_KEY });
      });

      const scheduleReconnect = () => {
        if (stoppedRef.current) return;
        const attempt = attemptRef.current++;
        if (attempt >= MAX_RECONNECT_ATTEMPTS) {
          // Exhausted fast retries — schedule a fallback retry that resets the cycle
          attemptRef.current = 0;
          window.setTimeout(connect, FALLBACK_RETRY_MS);
          return;
        }
        const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_CAP_MS);
        window.setTimeout(connect, delay);
      };

      socket.on("disconnect", scheduleReconnect);

      socket.on("connect_error", () => {
        socket.disconnect();
        scheduleReconnect();
      });
    };

    connect();

    return () => {
      stoppedRef.current = true;
      const socket = socketRef.current;
      socketRef.current = null;
      if (socket) {
        socket.disconnect();
      }
    };
  }, [ready, authenticated, token, qc]);
}
