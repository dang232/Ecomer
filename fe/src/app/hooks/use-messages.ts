import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  listMessages,
  markThreadRead,
  sendMessage,
  type ChatMessage,
  type MessagesPage,
} from "../lib/api/endpoints/messaging";

import { useAuth } from "./auth-context";
import { THREADS_KEY } from "./use-threads";

export const messagesKey = (threadId: string | undefined) =>
  ["messaging", "messages", threadId ?? ""] as const;

/**
 * First-page fetch for a thread's messages. Cursor-paginated on the BE; this
 * hook only loads the most recent page — older messages are loaded on demand
 * by a future infinite-scroll pass. New messages from the WebSocket are
 * spliced into the cache by `useMessagingSocket`, no refetch needed.
 */
export function useMessages(threadId: string | undefined, limit = 50) {
  const { ready, authenticated } = useAuth();
  return useQuery({
    queryKey: messagesKey(threadId),
    queryFn: () => {
      if (!threadId) throw new Error("A thread ID is required to load messages");
      return listMessages(threadId, { limit });
    },
    enabled: ready && authenticated && !!threadId,
    retry: false,
  });
}

/**
 * Optimistically appends a message to the cache and POSTs it. On error we roll
 * back. The Idempotency-Key is generated inside `sendMessage` so retried mutations
 * after a transient failure don't double-write.
 */
export function useSendMessage(threadId: string | undefined) {
  const qc = useQueryClient();

  return useMutation<
    ChatMessage,
    unknown,
    { body: string },
    { previous?: MessagesPage; placeholderId?: string }
  >({
    mutationFn: ({ body }) => {
      if (!threadId) throw new Error("A thread ID is required to send a message");
      return sendMessage(threadId, { body });
    },
    onMutate: async ({ body }) => {
      if (!threadId) return {};
      const key = messagesKey(threadId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<MessagesPage>(key);
      const placeholderId = `pending-${Math.random().toString(36).slice(2)}`;
      const placeholder: ChatMessage = {
        id: placeholderId,
        threadId,
        // Sender is filled in by the WS payload when the server echoes back.
        // Until then we display the message as-sent.
        senderId: "__pending__",
        body: body.trim(),
        sentAt: new Date().toISOString(),
      };
      qc.setQueryData<MessagesPage>(key, (prev) => {
        const base: MessagesPage = prev ?? { content: [], nextCursor: null, hasMore: false };
        // Most-recent first ordering matches the BE — prepend.
        return { ...base, content: [placeholder, ...base.content] };
      });
      return { previous, placeholderId };
    },
    onSuccess: (saved, _vars, context) => {
      if (!threadId || !context?.placeholderId) return;
      const key = messagesKey(threadId);
      qc.setQueryData<MessagesPage>(key, (prev) => {
        if (!prev) return { content: [saved], nextCursor: null, hasMore: false };
        return {
          ...prev,
          content: prev.content.map((m) => (m.id === context.placeholderId ? saved : m)),
        };
      });
      void qc.invalidateQueries({ queryKey: THREADS_KEY });
    },
    onError: (_err, _vars, context) => {
      if (!threadId) return;
      const key = messagesKey(threadId);
      if (context?.previous) {
        qc.setQueryData(key, context.previous);
      } else if (context?.placeholderId) {
        qc.setQueryData<MessagesPage>(key, (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            content: prev.content.filter((m) => m.id !== context.placeholderId),
          };
        });
      }
    },
  });
}

export function useMarkThreadRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (threadId: string) => markThreadRead(threadId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: THREADS_KEY });
    },
  });
}
