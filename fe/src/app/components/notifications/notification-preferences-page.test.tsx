import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const getNotificationPreferencesMock = vi.fn();
const updateNotificationPreferencesMock = vi.fn();

vi.mock("@/shared/api/endpoints/notification-preferences", () => ({
  getNotificationPreferences: (...args: unknown[]) => getNotificationPreferencesMock(...args),
  updateNotificationPreferences: (...args: unknown[]) =>
    updateNotificationPreferencesMock(...args),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
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
      name: "notificationPreferences.types.ORDER_SHIPPED.channels.EMAIL",
    });
    fireEvent.click(emailToggle);
    fireEvent.click(screen.getByRole("button", { name: "notificationPreferences.save" }));

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

    expect(await screen.findByText("notificationPreferences.saved")).toBeInTheDocument();
  });

  it("rolls the UI back after a failed save", async () => {
    getNotificationPreferencesMock.mockResolvedValue(basePreferences);
    updateNotificationPreferencesMock.mockRejectedValue(new Error("boom"));

    renderWithClient(<NotificationPreferencesPage />);

    const emailToggle = await screen.findByRole("switch", {
      name: "notificationPreferences.types.ORDER_SHIPPED.channels.EMAIL",
    });

    expect(emailToggle).toHaveAttribute("aria-checked", "true");
    fireEvent.click(emailToggle);
    expect(emailToggle).toHaveAttribute("aria-checked", "false");

    fireEvent.click(screen.getByRole("button", { name: "notificationPreferences.save" }));

    await waitFor(() =>
      expect(screen.getByText("notificationPreferences.saveError")).toBeInTheDocument(),
    );
    await waitFor(() => expect(emailToggle).toHaveAttribute("aria-checked", "true"));
  });
});
