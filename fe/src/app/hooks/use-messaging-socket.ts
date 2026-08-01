import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { z } from "zod";

import {
  messageSchema,
  type ChatMessage,
  type MessagesPage,
} from "@/shared/api/endpoints/messaging";

import { readJsonText } from "../../shared/api/read-json";

import { useAuth } from "./auth-context";
import { useAppConfig } from "./use-app-config";
import { messagesKey } from "./use-messages";
import { THREADS_KEY } from "./use-threads";

const messagingEnvelopeSchema = z
  .object({ type: z.string().optional(), payload: z.unknown().optional() })
  .passthrough();
const messagePayloadSchema = z
  .object({
    threadId: z.string().optional(),
    senderId: z.string().optional(),
    messageId: z.string().optional(),
    body: z.string().optional(),
    sentAt: z.string().optional(),
  })
  .passthrough();

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
          const envelope = readJsonText(
            typeof event.data === "string" ? event.data : "",
            messagingEnvelopeSchema,
          );

          // Handle batch catch-up response from server
          if (envelope.type === "message:catch-up") {
            const batch = z.array(messageSchema).safeParse(envelope.payload);
            if (!batch.success) return;
            for (const message of batch.data) {
              appendIfNew(qc, message);
              if (message.sentAt) {
                lastSeenRef.current = message.sentAt;
              }
            }
            return;
          }

          if (envelope.type !== "message" || !envelope.payload) return;
          const payload = messagePayloadSchema.safeParse(envelope.payload);
          if (!payload.success) return;
          const incoming = messageSchema.safeParse({
            id: payload.data.messageId,
            threadId: payload.data.threadId,
            senderId: payload.data.senderId,
            body: payload.data.body,
            sentAt: payload.data.sentAt,
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
