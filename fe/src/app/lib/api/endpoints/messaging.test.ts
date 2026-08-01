import { describe, expect, it } from "vitest";

import { messageSchema, messageThreadSummarySchema } from "./messaging";

/**
 * Regression coverage for the messaging service Zod envelopes. The BE wire
 * format is the same `ApiResponse<T>` envelope used everywhere else; these
 * tests pin the inner thread/message shape so a BE rename surfaces here
 * instead of crashing the MessagesPage at render time.
 */
describe("messaging endpoint Zod schemas", () => {
  const validThread = {
    id: "t1",
    buyerId: "alice",
    sellerId: "zoe",
    otherPartyId: "zoe",
    productId: "P1",
    lastMessageAt: "2026-05-17T10:00:00Z",
    lastMessageBody: "Hi",
    lastMessageSenderId: "alice",
    unreadCount: 2,
  };

  it("messageThreadSummarySchema accepts a fully populated thread row", () => {
    const parsed = messageThreadSummarySchema.parse(validThread);
    expect(parsed.unreadCount).toBe(2);
    expect(parsed.otherPartyId).toBe("zoe");
  });

  it("messageThreadSummarySchema tolerates a null productId for general shop chats", () => {
    expect(() =>
      messageThreadSummarySchema.parse({ ...validThread, productId: null }),
    ).not.toThrow();
  });

  it("messageThreadSummarySchema tolerates server-side extras through .loose()", () => {
    expect(() =>
      messageThreadSummarySchema.parse({
        ...validThread,
        // Future field — must not break parsing.
        sellerName: "Cửa hàng ABC",
      }),
    ).not.toThrow();
  });

  it("messageThreadSummarySchema rejects when otherPartyId is missing", () => {
    expect(() =>
      messageThreadSummarySchema.parse({ ...validThread, otherPartyId: undefined }),
    ).toThrow();
  });

  it("messageSchema accepts the wire shape from POST /messages", () => {
    const parsed = messageSchema.parse({
      id: "m1",
      threadId: "t1",
      senderId: "alice",
      body: "Hello",
      sentAt: "2026-05-17T10:00:00Z",
    });
    expect(parsed.body).toBe("Hello");
  });

  it("messageSchema requires non-empty body string", () => {
    expect(() =>
      messageSchema.parse({
        id: "m1",
        threadId: "t1",
        senderId: "alice",
        sentAt: "2026-05-17T10:00:00Z",
      }),
    ).toThrow();
  });
});
