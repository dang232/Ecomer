import { z } from "zod";

export const notificationChannelSchema = z.enum(["IN_APP", "EMAIL"]);
export type NotificationChannel = z.infer<typeof notificationChannelSchema>;

export const typePreferenceSchema = z.object({
  type: z.string(),
  channels: z.array(notificationChannelSchema),
});
export type TypePreference = z.infer<typeof typePreferenceSchema>;

export const notificationPreferencesSchema = z.object({
  muted: z.boolean(),
  typePreferences: z.array(typePreferenceSchema),
  updatedAt: z.string(),
});
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
