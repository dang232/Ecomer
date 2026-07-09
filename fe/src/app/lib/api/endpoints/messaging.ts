import { z } from "zod";

import { api } from "../client";

export const messageThreadSummarySchema = z
  .object({
    id: z.string(),
    buyerId: z.string(),
    sellerId: z.string(),
    otherPartyId: z.string(),
    otherPartyUsername: z.string().nullable().optional(),
    productId: z.string().nullable().optional(),
    lastMessageAt: z.string(),
    lastMessageBody: z.string().nullable().optional(),
    lastMessageSenderId: z.string().nullable().optional(),
    unreadCount: z.number().optional().default(0),
  })
  .loose();
export type MessageThreadSummary = z.infer<typeof messageThreadSummarySchema>;

const threadListSchema = z.object({ content: z.array(messageThreadSummarySchema) }).loose();

export const messageSchema = z
  .object({
    id: z.string(),
    threadId: z.string(),
    senderId: z.string(),
    body: z.string(),
    sentAt: z.string(),
  })
  .loose();
export type ChatMessage = z.infer<typeof messageSchema>;

const messagesPageSchema = z
  .object({
    content: z.array(messageSchema),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  })
  .loose();
export type MessagesPage = z.infer<typeof messagesPageSchema>;

const threadCreatedSchema = z
  .object({
    id: z.string(),
    buyerId: z.string(),
    sellerId: z.string(),
    otherPartyId: z.string(),
    productId: z.string().nullable().optional(),
    lastMessageAt: z.string(),
  })
  .loose();
export type ThreadCreated = z.infer<typeof threadCreatedSchema>;

const readResponseSchema = z.object({ readAt: z.string() }).loose();

export const listThreads = (params: { limit?: number } = {}) =>
  api.get("/messaging/threads", threadListSchema, { limit: params.limit });

export const openThread = (body: { recipientId: string; productId?: string | null }) =>
  api.post("/messaging/threads", threadCreatedSchema, body);

export const listMessages = (
  threadId: string,
  params: { cursor?: string | null; limit?: number } = {},
) =>
  api.get(`/messaging/threads/${encodeURIComponent(threadId)}/messages`, messagesPageSchema, {
    cursor: params.cursor ?? undefined,
    limit: params.limit,
  });

export const sendMessage = (threadId: string, body: { body: string; idempotencyKey?: string }) => {
  const key = body.idempotencyKey ?? crypto.randomUUID();
  return api.post(
    `/messaging/threads/${encodeURIComponent(threadId)}/messages`,
    messageSchema,
    { body: body.body },
    { idempotencyKey: key },
  );
};

export const markThreadRead = (threadId: string) =>
  api.post(`/messaging/threads/${encodeURIComponent(threadId)}/read`, readResponseSchema);
