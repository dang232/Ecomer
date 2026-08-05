import { z } from "zod";

import { pageSchema } from "@/shared/contracts/api/shared";

export const notificationTypeSchema = z.enum([
  "ORDER_CREATED",
  "ORDER_CANCELLED",
  "ORDER_SHIPPED",
  "ORDER_DELIVERED",
  "PAYMENT_COMPLETED",
  "PAYMENT_REFUNDED",
  "USER_REGISTERED",
  "USER_PASSWORD_RESET",
  "SELLER_NEW_ORDER",
  "PRODUCT_APPROVED",
  "PRODUCT_REJECTED",
  "REVIEW_REPLIED",
  "RETURN_REQUESTED",
  "PAYOUT_COMPLETED",
  "VIDEO_PUBLISHED",
  "VIDEO_REJECTED",
]);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const prioritySchema = z.enum(["HIGH", "MEDIUM", "LOW"]);
export type Priority = z.infer<typeof prioritySchema>;

export const notificationSchema = z.object({
  id: z.string(),
  type: notificationTypeSchema,
  title: z.string(),
  body: z.string(),
  deepLink: z.string().nullable(),
  priority: prioritySchema,
  threadId: z.string().nullable(),
  threadTitle: z.string().nullable(),
  read: z.boolean(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});
export type Notification = z.infer<typeof notificationSchema>;

export const notificationPageSchema = pageSchema(notificationSchema);
export type NotificationPage = z.infer<typeof notificationPageSchema>;

export const notificationThreadSchema = z.object({
  threadId: z.string(),
  threadTitle: z.string(),
  unreadCount: z.number(),
  totalCount: z.number(),
  updatedAt: z.string(),
});
export type NotificationThread = z.infer<typeof notificationThreadSchema>;

export const threadPageSchema = pageSchema(notificationThreadSchema);
export type ThreadPage = z.infer<typeof threadPageSchema>;

/** Response from `POST /notifications/mark-all-read`. */
export const markAllNotificationsReadResponseSchema = z.object({ updated: z.number() });

/** Response from `GET /notifications/unread-count`. */
export const unreadNotificationCountResponseSchema = z.object({ count: z.number() });
