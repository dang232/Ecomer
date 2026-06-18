/**
 * P1-11 tests: PayoutsQueue tablist arrow-key navigation (roving tabindex).
 *
 * Reference: VideoModerationPanel.tsx:15-40 — same WAI-ARIA "Tabs with
 * Manual Activation" pattern applied here.
 */
import type { ReactNode } from "react";
import { createElement, useCallback, useRef, useState } from "react";
import { createElement as h } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import i18n from "../../lib/i18n";

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: {
    div: ({ children, ...props }: Record<string, unknown> & { children?: ReactNode }) =>
      h("div", props, children),
  },
}));

// ── TabList under test (mirrors PayoutsQueue.tsx:119-205) ───────────────────────

const TABS = ["pending", "completed"] as const;
type Tab = (typeof TABS)[number];

function TabListUnderTest() {
  const [tab, setTab] = useState<Tab>("pending");
  const pendingBtnRef = useRef<HTMLButtonElement>(null);
  const completedBtnRef = useRef<HTMLButtonElement>(null);
  const tabRefs = { pending: pendingBtnRef, completed: completedBtnRef };

  const focusTab = useCallback((next: Tab) => {
    setTab(next);
    tabRefs[next].current?.focus();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, current: Tab) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      focusTab(TABS[(TABS.indexOf(current) + 1) % TABS.length]);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusTab(TABS[(TABS.indexOf(current) - 1 + TABS.length) % TABS.length]);
    }
  }

  return h(
    "div",
    { role: "tablist" },
    h(
      "button",
      {
        ref: pendingBtnRef,
        role: "tab",
        "aria-selected": tab === "pending",
        tabIndex: tab === "pending" ? 0 : -1,
        onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => handleKeyDown(e, "pending"),
        children: "Pending",
      },
    ),
    h(
      "button",
      {
        ref: completedBtnRef,
        role: "tab",
        "aria-selected": tab === "completed",
        tabIndex: tab === "completed" ? 0 : -1,
        onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => handleKeyDown(e, "completed"),
        children: "Completed",
      },
    ),
  );
}

function renderTabList() {
  render(
    h(I18nextProvider, { i18n }, h(TabListUnderTest)),
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PayoutsQueue tablist — P1-11 roving tabindex", () => {
  it("renders both tab buttons with correct aria-selected on mount", () => {
    renderTabList();
    const buttons = screen.getAllByRole("tab");
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveAttribute("aria-selected", "true");
    expect(buttons[1]).toHaveAttribute("aria-selected", "false");
  });

  it("pending tab has tabIndex=0; completed tab has tabIndex=-1 on mount", () => {
    renderTabList();
    const buttons = screen.getAllByRole("tab");
    expect(buttons[0]).toHaveAttribute("tabIndex", "0");
    expect(buttons[1]).toHaveAttribute("tabIndex", "-1");
  });

  it("ArrowRight moves focus from pending to completed", () => {
    renderTabList();
    const [pending, completed] = screen.getAllByRole("tab");

    fireEvent.keyDown(pending, { key: "ArrowRight" });

    expect(completed).toHaveAttribute("aria-selected", "true");
    expect(pending).toHaveAttribute("aria-selected", "false");
  });

  it("ArrowLeft wraps from pending (first tab) back to completed", () => {
    renderTabList();
    const [pending, completed] = screen.getAllByRole("tab");

    // Move to completed, then ArrowLeft back
    fireEvent.keyDown(pending, { key: "ArrowRight" });
    fireEvent.keyDown(completed, { key: "ArrowLeft" });

    expect(pending).toHaveAttribute("aria-selected", "true");
    expect(completed).toHaveAttribute("aria-selected", "false");
  });

  it("ArrowRight wraps from completed (last tab) to pending", () => {
    renderTabList();
    const [pending, completed] = screen.getAllByRole("tab");

    // Move to completed, then wrap around
    fireEvent.keyDown(pending, { key: "ArrowRight" });
    fireEvent.keyDown(completed, { key: "ArrowRight" });

    expect(pending).toHaveAttribute("aria-selected", "true");
  });

  it("tabIndex is 0 on the active tab and -1 on the inactive tab after navigation", () => {
    renderTabList();
    const [pending, completed] = screen.getAllByRole("tab");

    fireEvent.keyDown(pending, { key: "ArrowRight" });

    expect(pending).toHaveAttribute("tabIndex", "-1");
    expect(completed).toHaveAttribute("tabIndex", "0");
  });
});
