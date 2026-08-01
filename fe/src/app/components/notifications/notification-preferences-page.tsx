import { Bell, BellOff, Mail, Settings } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/shared/api/endpoints/notification-preferences";
import type {
  NotificationChannel,
  NotificationPreferences,
  TypePreference,
} from "@/shared/contracts/api/notification-preferences";

const PREFERENCES_KEY = ["notifications", "preferences"] as const;

const NOTIFICATION_TYPES = [
  "ORDER_CREATED",
  "ORDER_CANCELLED",
  "ORDER_SHIPPED",
  "ORDER_DELIVERED",
  "PAYMENT_COMPLETED",
  "PAYMENT_REFUNDED",
  "SELLER_NEW_ORDER",
  "PRODUCT_APPROVED",
  "PRODUCT_REJECTED",
  "REVIEW_REPLIED",
  "RETURN_REQUESTED",
  "PAYOUT_COMPLETED",
] as const;

const CHANNELS: ReadonlyArray<{ key: NotificationChannel; icon: typeof Bell }> = [
  { key: "IN_APP", icon: Bell },
  { key: "EMAIL", icon: Mail },
];

type SaveState = "idle" | "saving" | "saved" | "error";

function normalizePreferences(preferences: NotificationPreferences): NotificationPreferences {
  const byType = new Map(preferences.typePreferences.map((entry) => [entry.type, entry]));
  const known = NOTIFICATION_TYPES.map(
    (type) =>
      byType.get(type) ??
      ({
        type,
        channels: ["IN_APP", "EMAIL"] satisfies NotificationChannel[],
      } as TypePreference),
  );
  const extras = preferences.typePreferences.filter((entry) => !NOTIFICATION_TYPES.includes(entry.type as (typeof NOTIFICATION_TYPES)[number]));
  return {
    ...preferences,
    typePreferences: [...known, ...extras],
  };
}

export function NotificationPreferencesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<NotificationPreferences | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const query = useQuery({
    queryKey: PREFERENCES_KEY,
    queryFn: getNotificationPreferences,
    retry: false,
  });

  useEffect(() => {
    if (query.data) {
      setDraft(normalizePreferences(query.data));
      setDirty(false);
    }
  }, [query.data]);

  const mutation = useMutation<
    NotificationPreferences,
    Error,
    { muted: boolean; typePreferences: TypePreference[] },
    { previous?: NotificationPreferences }
  >({
    mutationFn: updateNotificationPreferences,
    onMutate: async (body) => {
      setSaveState("saving");
      await queryClient.cancelQueries({ queryKey: PREFERENCES_KEY });
      const previous = queryClient.getQueryData<NotificationPreferences>(PREFERENCES_KEY);
      queryClient.setQueryData<NotificationPreferences>(PREFERENCES_KEY, (current) =>
        current
          ? {
              ...current,
              muted: body.muted,
              typePreferences: body.typePreferences,
              updatedAt: new Date().toISOString(),
            }
          : current,
      );
      return { previous };
    },
    onSuccess: (next) => {
      const normalized = normalizePreferences(next);
      queryClient.setQueryData(PREFERENCES_KEY, normalized);
      setDraft(normalized);
      setDirty(false);
      setSaveState("saved");
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        const normalized = normalizePreferences(context.previous);
        queryClient.setQueryData(PREFERENCES_KEY, normalized);
        setDraft(normalized);
      }
      setSaveState("error");
    },
  });

  const preferenceByType = useMemo(() => {
    return new Map((draft?.typePreferences ?? []).map((entry) => [entry.type, entry]));
  }, [draft?.typePreferences]);
  const renderedTypes = useMemo(
    () => draft?.typePreferences.map((entry) => entry.type) ?? [...NOTIFICATION_TYPES],
    [draft?.typePreferences],
  );

  const toggleChannel = (type: string, channel: NotificationChannel) => {
    setDraft((current) => {
      if (!current) return current;
      const nextPreferences = current.typePreferences.map((entry) => {
        if (entry.type !== type) return entry;
        const enabled = entry.channels.includes(channel);
        return {
          ...entry,
          channels: enabled
            ? entry.channels.filter((value) => value !== channel)
            : [...entry.channels, channel],
        };
      });
      return { ...current, typePreferences: nextPreferences };
    });
    setDirty(true);
    setSaveState("idle");
  };

  const save = () => {
    if (!draft) return;
    mutation.mutate({
      muted: draft.muted,
      typePreferences: draft.typePreferences,
    });
  };

  if (query.isError) {
    return (
      <div className="mx-auto max-w-3xl rounded-[var(--radius-lg)] border border-border bg-card px-6 py-8">
        <p className="text-sm text-error">{t("notificationPreferences.loadError")}</p>
      </div>
    );
  }

  if (query.isLoading || !draft) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="h-24 rounded bg-muted" />
          <div className="h-16 rounded bg-muted" />
          <div className="h-16 rounded bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl rounded-[var(--radius-lg)] border border-border bg-card px-6 py-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Settings size={22} className="text-foreground" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {t("notificationPreferences.title", { defaultValue: "Notification preferences" })}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("notificationPreferences.subtitle", {
                defaultValue: "Choose which supported updates VNShop can send to you.",
              })}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || mutation.isPending}
          className="rounded-[var(--radius-md)] bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {mutation.isPending
            ? t("notificationPreferences.saving", { defaultValue: "Saving..." })
            : t("notificationPreferences.save", { defaultValue: "Save changes" })}
        </button>
      </header>

      <section className="mt-6 rounded-[var(--radius-md)] border border-border p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {draft.muted ? (
              <BellOff size={20} className="mt-0.5 text-muted-foreground" />
            ) : (
              <Bell size={20} className="mt-0.5 text-foreground" />
            )}
            <div>
              <p className="font-medium text-foreground">
                {t(draft.muted ? "notificationPreferences.mutedTitle" : "notificationPreferences.activeTitle")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t(
                  draft.muted
                    ? "notificationPreferences.mutedDescription"
                    : "notificationPreferences.activeDescription",
                  {
                    defaultValue: draft.muted
                      ? "You will not receive in-app or email updates until you turn notifications back on."
                      : "Adjust each supported notification type below.",
                  },
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={draft.muted ? "true" : "false"}
            aria-label={t("notificationPreferences.muteToggle", {
              defaultValue: "Mute all notifications",
            })}
            onClick={() => {
              setDraft((current) => (current ? { ...current, muted: !current.muted } : current));
              setDirty(true);
              setSaveState("idle");
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full ${
              draft.muted ? "bg-muted" : "bg-primary"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                draft.muted ? "translate-x-1" : "translate-x-6"
              }`}
            />
          </button>
        </div>
      </section>

      <div className={`mt-6 space-y-3 ${draft.muted ? "pointer-events-none opacity-50" : ""}`}>
        {renderedTypes.map((type) => {
          const preference = preferenceByType.get(type) ?? { type, channels: ["IN_APP", "EMAIL"] };
          return (
            <section
              key={type}
              className="rounded-[var(--radius-md)] border border-border px-4 py-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    {t(`notificationPreferences.types.${type}.label`, { defaultValue: type })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t(`notificationPreferences.types.${type}.description`, { defaultValue: type })}
                  </p>
                </div>
                <div className="flex gap-3">
                  {CHANNELS.map((channel) => {
                    const enabled = preference.channels.includes(channel.key);
                    const Icon = channel.icon;
                    return (
                      <button
                        key={channel.key}
                        type="button"
                        role="switch"
                        aria-checked={enabled ? "true" : "false"}
                        aria-label={t(`notificationPreferences.types.${type}.channels.${channel.key}`, {
                          defaultValue: `${type} ${channel.key}`,
                        })}
                        onClick={() => toggleChannel(type, channel.key)}
                        className={`inline-flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-sm ${
                          enabled
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        <Icon size={16} />
                        {t(`notificationPreferences.channels.${channel.key}`, {
                          defaultValue: channel.key === "IN_APP" ? "In app" : "Email",
                        })}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {saveState === "saved" ? (
        <p className="mt-4 text-sm text-success">
          {t("notificationPreferences.saved", { defaultValue: "Preferences saved." })}
        </p>
      ) : null}
      {saveState === "error" ? (
        <p className="mt-4 text-sm text-error">
          {t("notificationPreferences.saveError", {
            defaultValue: "Could not save your notification preferences.",
          })}
        </p>
      ) : null}
    </div>
  );
}
