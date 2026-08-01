import {
  notificationPreferencesSchema,
  type TypePreference,
} from "../../../types/api/notification-preferences";
import { api } from "../client";

export const getNotificationPreferences = () =>
  api.get("/notifications/preferences", notificationPreferencesSchema);

export const updateNotificationPreferences = (body: {
  muted: boolean;
  typePreferences: TypePreference[];
}) => api.put("/notifications/preferences", notificationPreferencesSchema, body);
