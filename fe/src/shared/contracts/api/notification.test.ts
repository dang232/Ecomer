import { describe, expect, it } from "vitest";

import { notificationSchema, notificationTypeSchema } from "@/shared/contracts/api/notification";

describe("notificationTypeSchema", () => {
  it.each(["USER_REGISTERED", "USER_PASSWORD_RESET"] as const)(
    "accepts backend notification type %s",
    (type) => {
      expect(notificationTypeSchema.parse(type)).toBe(type);
    },
  );
});

describe("notificationSchema", () => {
  it("parses a password reset notification from the backend", () => {
    const result = notificationSchema.parse({
      id: "notification-2",
      type: "USER_PASSWORD_RESET",
      title: "Password reset requested",
      body: "Review your recent security request.",
      deepLink: "/reset-password",
      priority: "HIGH",
      threadId: null,
      threadTitle: null,
      read: false,
      readAt: null,
      createdAt: "2026-08-04T10:00:00Z",
    });

    expect(result.type).toBe("USER_PASSWORD_RESET");
  });
});
