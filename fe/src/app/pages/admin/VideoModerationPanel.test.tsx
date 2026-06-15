import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { VideoModerationPanel } from "./VideoModerationPanel";

vi.mock("./VideoModeration", () => ({
  VideoModeration: () => <div data-testid="video-moderation-queue" />,
}));

vi.mock("./VideoAppeals", () => ({
  VideoAppeals: () => <div data-testid="video-appeals" />,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("VideoModerationPanel", () => {
  it("renders Queue tab content by default", () => {
    render(<VideoModerationPanel />);
    expect(screen.getByTestId("video-moderation-queue")).toBeInTheDocument();
  });

  it("does not render Appeals content by default", () => {
    render(<VideoModerationPanel />);
    expect(screen.queryByTestId("video-appeals")).not.toBeInTheDocument();
  });

  it("switches to Appeals when appeals tab clicked", () => {
    render(<VideoModerationPanel />);

    const appealsTab = screen.getByRole("tab", { name: "admin.nav.videoAppeals" });
    fireEvent.click(appealsTab);

    expect(screen.getByTestId("video-appeals")).toBeInTheDocument();
    expect(screen.queryByTestId("video-moderation-queue")).not.toBeInTheDocument();
  });

  it("both tab buttons have role tab", () => {
    render(<VideoModerationPanel />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
  });

  it("active tab has aria-selected true by default", () => {
    render(<VideoModerationPanel />);
    const queueTab = screen.getByRole("tab", { name: "admin.nav.videoModeration" });
    const appealsTab = screen.getByRole("tab", { name: "admin.nav.videoAppeals" });

    expect(queueTab).toHaveAttribute("aria-selected", "true");
    expect(appealsTab).toHaveAttribute("aria-selected", "false");
  });

  it("active tab switches aria-selected when appeals tab clicked", () => {
    render(<VideoModerationPanel />);

    const appealsTab = screen.getByRole("tab", { name: "admin.nav.videoAppeals" });
    fireEvent.click(appealsTab);

    const queueTab = screen.getByRole("tab", { name: "admin.nav.videoModeration" });
    expect(appealsTab).toHaveAttribute("aria-selected", "true");
    expect(queueTab).toHaveAttribute("aria-selected", "false");
  });
});
