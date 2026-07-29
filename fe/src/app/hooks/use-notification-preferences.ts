import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "../lib/api/endpoints/notification-preferences";
import type {
  NotificationPreferences,
  TypePreference,
} from "../types/api/notification-preferences";

import { useAuth } from "./auth-context";

const PREFERENCES_KEY = ["notifications", "preferences"] as const;

export function useNotificationPreferences() {
  const { ready, authenticated } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: PREFERENCES_KEY,
    queryFn: () => getNotificationPreferences(),
    enabled: ready && authenticated,
    staleTime: 5 * 60 * 1000, // 5 min — preferences rarely change
  });

  const updateMutation = useMutation<
    NotificationPreferences,
    unknown,
    { muted: boolean; typePreferences: TypePreference[] },
    { previous?: NotificationPreferences }
  >({
    mutationFn: (body) => updateNotificationPreferences(body),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: PREFERENCES_KEY });
      const previous = qc.getQueryData<NotificationPreferences>(PREFERENCES_KEY);
      qc.setQueryData<NotificationPreferences>(PREFERENCES_KEY, (prev) =>
        prev ? { ...prev, ...body, updatedAt: new Date().toISOString() } : prev,
      );
      return { previous };
    },
    onSuccess: (data) => {
      qc.setQueryData(PREFERENCES_KEY, data);
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(PREFERENCES_KEY, context.previous);
    },
  });

  return {
    preferences: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    update: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
}
