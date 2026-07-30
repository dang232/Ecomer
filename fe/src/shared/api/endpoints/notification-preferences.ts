import {
  notificationPreferencesSchema,
  type TypePreference,
} from "@/shared/contracts/api/notification-preferences";
import { api } from "@/shared/api/client";

export const getNotificationPreferences = () =>
  api.get("/notifications/preferences", notificationPreferencesSchema);

export const updateNotificationPreferences = (body: {
  muted: boolean;
  typePreferences: TypePreference[];
}) => api.put("/notifications/preferences", notificationPreferencesSchema, body);
