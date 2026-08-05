import { describe, expect, it } from "vitest";

import { notificationSchema, notificationTypeSchema } from "./notification";

describe("notificationTypeSchema", () => {
  it.each(["USER_REGISTERED", "USER_PASSWORD_RESET"] as const)(
    "accepts backend notification type %s",
    (type) => {
      expect(notificationTypeSchema.parse(type)).toBe(type);
    },
  );
});

describe("notificationSchema", () => {
  it("parses a notification for newly registered users", () => {
    const result = notificationSchema.parse({
      id: "notification-1",
      type: "USER_REGISTERED",
      title: "Welcome to VNShop",
      body: "Your account is ready.",
      deepLink: "/profile",
      priority: "LOW",
      threadId: null,
      threadTitle: null,
      read: false,
      readAt: null,
      createdAt: "2026-08-04T09:00:00Z",
    });

    expect(result.type).toBe("USER_REGISTERED");
  });
});
