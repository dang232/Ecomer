import {
  markAllNotificationsReadResponseSchema,
  notificationSchema,
  notificationPageSchema,
  threadPageSchema,
  unreadNotificationCountResponseSchema,
} from "../../../types/api/notification";
import { api } from "../client";

export const listNotifications = (
  params: { page?: number; size?: number; type?: string; threadId?: string } = {},
) =>
  api.get("/notifications", notificationPageSchema, {
    page: params.page,
    size: params.size ?? 20,
    type: params.type,
    threadId: params.threadId,
  });

export const listThreads = (params: { page?: number; size?: number; type?: string } = {}) =>
  api.get("/notifications/threads", threadPageSchema, {
    page: params.page,
    size: params.size ?? 20,
    type: params.type,
  });

export const getThreadNotifications = (threadId: string) =>
  api.get(`/notifications/threads/${encodeURIComponent(threadId)}`, notificationSchema.array());

export const getNotification = (id: string) =>
  api.get(`/notifications/${encodeURIComponent(id)}`, notificationSchema);

export const markNotificationRead = (id: string) =>
  api.post(`/notifications/${encodeURIComponent(id)}/read`, notificationSchema);

export const markAllNotificationsRead = () =>
  api.post("/notifications/mark-all-read", markAllNotificationsReadResponseSchema);

export const unreadNotificationCount = () =>
  api.get("/notifications/unread-count", unreadNotificationCountResponseSchema);
