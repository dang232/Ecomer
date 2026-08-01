import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import enMessages from "@/app/lib/i18n/en.json";
import viMessages from "@/app/lib/i18n/vi.json";

type UnknownCall = (...args: unknown[]) => unknown;

const getNotificationPreferencesMock = vi.fn<UnknownCall>();
const updateNotificationPreferencesMock = vi.fn<UnknownCall>();
let currentLocale: "en" | "vi" = "en";

vi.mock("@/shared/api/endpoints/notification-preferences", () => ({
  getNotificationPreferences: (...args: unknown[]) => getNotificationPreferencesMock(...args),
  updateNotificationPreferences: (...args: unknown[]) => updateNotificationPreferencesMock(...args),
}));

function messageFor(locale: "en" | "vi", key: string): string | undefined {
  const source =
    locale === "en"
      ? (enMessages as Record<string, unknown>)
      : (viMessages as Record<string, unknown>);
  return key.split(".").reduce<unknown>((value, part) => {
    if (value && typeof value === "object" && part in value) {
      return (value as Record<string, unknown>)[part];
    }
    return undefined;
  }, source) as string | undefined;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      messageFor(currentLocale, key) ?? options?.defaultValue ?? key,
    i18n: { resolvedLanguage: currentLocale === "en" ? "en-US" : "vi-VN" },
  }),
}));

import { NotificationPreferencesPage } from "./notification-preferences-page";

const basePreferences = {
  muted: false,
  typePreferences: [
    {
      type: "ORDER_SHIPPED",
      channels: ["IN_APP", "EMAIL"] as const,
    },
    {
      type: "ORDER_DELIVERED",
      channels: ["IN_APP"] as const,
    },
  ],
  updatedAt: "2026-08-01T04:00:00Z",
};

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("NotificationPreferencesPage", () => {
  beforeEach(() => {
    getNotificationPreferencesMock.mockReset();
    updateNotificationPreferencesMock.mockReset();
    currentLocale = "en";
  });

  it.each([
    ["en" as const, "Notification preferences", "Save changes"],
    ["vi" as const, "Tuy chon thong bao", "Luu thay doi"],
  ])("renders real %s locale copy instead of raw keys", async (locale, heading, saveLabel) => {
    currentLocale = locale;
    getNotificationPreferencesMock.mockResolvedValue(basePreferences);

    renderWithClient(<NotificationPreferencesPage />);

    expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: saveLabel })).toBeDisabled();
    expect(screen.queryByText("notificationPreferences.title")).not.toBeInTheDocument();
  });

  it("loads preferences and saves the exact supported payload", async () => {
    getNotificationPreferencesMock.mockResolvedValue(basePreferences);
    updateNotificationPreferencesMock.mockResolvedValue({
      ...basePreferences,
      typePreferences: [
        {
          type: "ORDER_SHIPPED",
          channels: ["IN_APP"] as const,
        },
        {
          type: "ORDER_DELIVERED",
          channels: ["IN_APP"] as const,
        },
      ],
      updatedAt: "2026-08-01T04:05:00Z",
    });

    renderWithClient(<NotificationPreferencesPage />);

    const emailToggle = await screen.findByRole("switch", {
      name: "Order shipped by email",
    });
    fireEvent.click(emailToggle);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(updateNotificationPreferencesMock.mock.calls[0]?.[0]).toEqual({
        muted: false,
        typePreferences: [
          {
            type: "ORDER_CREATED",
            channels: ["IN_APP", "EMAIL"],
          },
          {
            type: "ORDER_CANCELLED",
            channels: ["IN_APP", "EMAIL"],
          },
          {
            type: "ORDER_SHIPPED",
            channels: ["IN_APP"],
          },
          {
            type: "ORDER_DELIVERED",
            channels: ["IN_APP"],
          },
          {
            type: "PAYMENT_COMPLETED",
            channels: ["IN_APP", "EMAIL"],
          },
          {
            type: "PAYMENT_REFUNDED",
            channels: ["IN_APP", "EMAIL"],
          },
          {
            type: "SELLER_NEW_ORDER",
            channels: ["IN_APP", "EMAIL"],
          },
          {
            type: "PRODUCT_APPROVED",
            channels: ["IN_APP", "EMAIL"],
          },
          {
            type: "PRODUCT_REJECTED",
            channels: ["IN_APP", "EMAIL"],
          },
          {
            type: "REVIEW_REPLIED",
            channels: ["IN_APP", "EMAIL"],
          },
          {
            type: "RETURN_REQUESTED",
            channels: ["IN_APP", "EMAIL"],
          },
          {
            type: "PAYOUT_COMPLETED",
            channels: ["IN_APP", "EMAIL"],
          },
        ],
      }),
    );

    expect(await screen.findByText("Preferences saved.")).toBeInTheDocument();
  });

  it("rolls the UI back after a failed save", async () => {
    getNotificationPreferencesMock.mockResolvedValue(basePreferences);
    updateNotificationPreferencesMock.mockRejectedValue(new Error("boom"));

    renderWithClient(<NotificationPreferencesPage />);

    const emailToggle = await screen.findByRole("switch", {
      name: "Order shipped by email",
    });

    expect(emailToggle).toHaveAttribute("aria-checked", "true");
    fireEvent.click(emailToggle);
    expect(emailToggle).toHaveAttribute("aria-checked", "false");

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(screen.getByText("Could not save your notification preferences.")).toBeInTheDocument(),
    );
    await waitFor(() => expect(emailToggle).toHaveAttribute("aria-checked", "true"));
  });

  it("exposes truthful mute-all switch state for both active and muted preference loads", async () => {
    getNotificationPreferencesMock.mockResolvedValue(basePreferences);

    const firstRender = renderWithClient(<NotificationPreferencesPage />);

    const muteSwitch = await screen.findByRole("switch", { name: "Mute all notifications" });
    expect(muteSwitch).toHaveAttribute("aria-checked", "false");

    fireEvent.click(muteSwitch);
    expect(muteSwitch).toHaveAttribute("aria-checked", "true");
    firstRender.unmount();

    getNotificationPreferencesMock.mockResolvedValue({
      ...basePreferences,
      muted: true,
    });

    renderWithClient(<NotificationPreferencesPage />);
    expect(await screen.findByRole("switch", { name: "Mute all notifications" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});
