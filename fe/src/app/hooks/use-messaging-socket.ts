import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { messageSchema, type ChatMessage, type MessagesPage } from "../lib/api/endpoints/messaging";

import { useAppConfig } from "./use-app-config";
import { useAuth } from "./use-auth";
import { messagesKey } from "./use-messages";
import { THREADS_KEY } from "./use-threads";

interface ServerEnvelope {
  type?: string;
  payload?: {
    threadId?: string;
    senderId?: string;
    messageId?: string;
    body?: string;
    sentAt?: string;
  } & Record<string, unknown>;
}

const RECONNECT_BASE_MS = 1000;
const RECONNECT_CAP_MS = 30_000;

/**
 * Boot-time WebSocket connection. Authenticates with the same JWT as REST
 * through a WebSocket subprotocol. Putting the token in the URL would expose
 * it to request logs, and browsers don't let us set Authorization headers on
 * `new WebSocket(...)`. The server validates the token before binding the
 * socket to the user and pushes
 * `{type:'message', payload:{...}}` events for the recipient on every Kafka
 * fan-out.
 *
 * Reconnects with exponential backoff capped at 30 s. Disabled while the
 * caller isn't authenticated.
 */
export function useMessagingSocket(): void {
  const { ready, authenticated, token } = useAuth();
  const config = useAppConfig();
  const qc = useQueryClient();
  const socketRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);
  const stoppedRef = useRef(false);
  const lastSeenRef = useRef<string | null>(null);
  const connectionIdRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const connectionId = ++connectionIdRef.current;
    stoppedRef.current = false;
    attemptRef.current = 0;
    lastSeenRef.current = null;

    const isCurrent = () => !stoppedRef.current && connectionIdRef.current === connectionId;

    if (!ready || !authenticated || !token) {
      return () => {
        stoppedRef.current = true;
      };
    }

    const connect = () => {
      if (!isCurrent()) return;
      const socket = new WebSocket(config.websocket.messagingUri, [
        "vnshop-auth",
        `vnshop-jwt.${token}`,
      ]);
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        if (!isCurrent()) return;
        attemptRef.current = 0;
        // Request catch-up for messages missed during reconnect/token refresh
        if (lastSeenRef.current) {
          socket.send(
            JSON.stringify({ type: "message:catch-up", payload: { since: lastSeenRef.current } }),
          );
        }
      });

      socket.addEventListener("message", (event) => {
        if (!isCurrent()) return;
        try {
          const raw: unknown = JSON.parse(typeof event.data === "string" ? event.data : "");
          const envelope = raw as ServerEnvelope;

          // Handle batch catch-up response from server
          if (envelope.type === "message:catch-up") {
            const batch = (raw as { payload?: unknown[] }).payload;
            if (!Array.isArray(batch)) return;
            for (const item of batch) {
              const parsed = messageSchema.safeParse(item);
              if (!parsed.success) continue;
              appendIfNew(qc, parsed.data);
              if (parsed.data.sentAt) {
                lastSeenRef.current = parsed.data.sentAt;
              }
            }
            return;
          }

          if (envelope.type !== "message" || !envelope.payload) return;
          const incoming = messageSchema.safeParse({
            id: envelope.payload.messageId,
            threadId: envelope.payload.threadId,
            senderId: envelope.payload.senderId,
            body: envelope.payload.body,
            sentAt: envelope.payload.sentAt,
          });
          if (!incoming.success) return;
          if (incoming.data.sentAt) {
            lastSeenRef.current = incoming.data.sentAt;
          }
          appendIfNew(qc, incoming.data);
        } catch {
          // Malformed frame — ignore. Server is authoritative on what's saved.
        }
      });

      const scheduleReconnect = () => {
        if (!isCurrent() || reconnectTimerRef.current !== null) return;
        const attempt = attemptRef.current++;
        const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_CAP_MS);
        reconnectTimerRef.current = window.setTimeout(() => {
          reconnectTimerRef.current = null;
          connect();
        }, delay);
      };

      socket.addEventListener("close", scheduleReconnect);
      socket.addEventListener("error", () => {
        try {
          socket.close();
        } catch {
          // Already closed.
        }
      });
    };

    connect();

    return () => {
      stoppedRef.current = true;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      const socket = socketRef.current;
      if (socketRef.current === socket) socketRef.current = null;
      lastSeenRef.current = null;
      if (
        socket &&
        (socket.readyState === socket.OPEN || socket.readyState === socket.CONNECTING)
      ) {
        try {
          socket.close();
        } catch {
          // Already closed.
        }
      }
    };
  }, [ready, authenticated, token, qc, config.websocket.messagingUri]);
}

function appendIfNew(qc: ReturnType<typeof useQueryClient>, message: ChatMessage): void {
  qc.setQueryData<MessagesPage>(messagesKey(message.threadId), (prev) => {
    const base: MessagesPage = prev ?? { content: [], nextCursor: null, hasMore: false };
    if (base.content.some((m) => m.id === message.id)) return base;
    // Replace any optimistic placeholder for this thread (same body within a
    // few seconds) so the local echo doesn't double up with the server echo.
    const filtered = base.content.filter((m) => {
      if (!m.id.startsWith("pending-")) return true;
      if (m.body !== message.body) return true;
      const sameBucket =
        Math.abs(new Date(m.sentAt).getTime() - new Date(message.sentAt).getTime()) < 30_000;
      return !sameBucket;
    });
    return { ...base, content: [message, ...filtered] };
  });
  void qc.invalidateQueries({ queryKey: THREADS_KEY });
}
