/**
 * P1-11 tests: PayoutsQueue tablist arrow-key navigation (roving tabindex).
 * Tests render the REAL PayoutsQueue component; useQuery is mocked so the
 * component exercises its own tab state, focus management, and key handlers.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import type { HTMLAttributes, ReactNode } from "react";
import { createElement as h } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminPayout } from "../../types/api";

// ── Mock AnimatePresence so FormDialog renders synchronously in jsdom ────────

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) =>
      h("div", props, children),
  },
}));

// ── Mock tanstack/react-query ────────────────────────────────────────────────

// Shared mutable state so each test can configure data before calling render.
const pendingData = vi.fn(() => ({ data: [] as AdminPayout[], isLoading: false, isError: false }));
const completedData = vi.fn(() => ({
  data: [] as AdminPayout[],
  isLoading: false,
  isError: false,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    const key = queryKey[2];
    if (key === "pending") return pendingData();
    if (key === "completed") return completedData();
    return { data: undefined, isLoading: false, isError: false };
  },
  useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

// ── Mock i18n — return the key itself ─────────────────────────────────────

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));

// ── Mock API endpoints (unused but imported by component) ─────────────────────

vi.mock("../../lib/api/endpoints/admin", () => ({
  adminPendingPayouts: vi.fn(),
  adminCompletedPayouts: vi.fn(),
  adminCompletePayout: vi.fn(),
  adminFailPayout: vi.fn(),
}));

// ── Mock tabler icons ─────────────────────────────────────────────────────────

vi.mock("@tabler/icons-react", () => ({
  IconArrowsSort: () => h("span", null, "sort"),
  IconSearch: () => h("span", null, "search"),
}));

// ── Mock sonner toast ─────────────────────────────────────────────────────────

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// ── Component under test ─────────────────────────────────────────────────────

import { PayoutsQueue } from "./PayoutsQueue";

// ── Fixture helpers ───────────────────────────────────────────────────────────

function _makeAdminPayout(overrides: Partial<AdminPayout> = {}): AdminPayout {
  return {
    id: "payout-1",
    sellerId: "seller-001" as AdminPayout["sellerId"],
    sellerName: "Test Seller",
    amount: 100_000,
    status: "PENDING",
    requestedAt: "2024-06-01T10:00:00Z",
    completedBy: undefined,
    completedAt: undefined,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PayoutsQueue tablist — P1-11 roving tabindex", () => {
  // Reset mock implementations before each test
  beforeEach(() => {
    pendingData.mockImplementation(() => ({
      data: [] as AdminPayout[],
      isLoading: false,
      isError: false,
    }));
    completedData.mockImplementation(() => ({
      data: [] as AdminPayout[],
      isLoading: false,
      isError: false,
    }));
  });

  it("PQ1 — renders both tabs with role='tab'; pending selected by default", () => {
    render(<PayoutsQueue />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveAttribute("aria-selected", "false");
  });

  it("PQ2 — pending tab has tabIndex=0; completed tab has tabIndex=-1 on mount", () => {
    render(<PayoutsQueue />);

    const [pending, completed] = screen.getAllByRole("tab");
    expect(pending).toHaveAttribute("tabIndex", "0");
    expect(completed).toHaveAttribute("tabIndex", "-1");
  });

  it("PQ3 — ArrowRight on pending moves focus to completed and updates aria-selected", () => {
    render(<PayoutsQueue />);

    const [pending, completed] = screen.getAllByRole("tab");
    fireEvent.keyDown(pending, { key: "ArrowRight" });

    expect(completed).toHaveAttribute("aria-selected", "true");
    expect(pending).toHaveAttribute("aria-selected", "false");
  });

  it("PQ4 — ArrowLeft wraps from pending (first tab) back to completed", () => {
    render(<PayoutsQueue />);

    const [pending, completed] = screen.getAllByRole("tab");

    // ArrowLeft from first tab wraps to last
    fireEvent.keyDown(pending, { key: "ArrowLeft" });

    expect(pending).toHaveAttribute("aria-selected", "false");
    expect(completed).toHaveAttribute("aria-selected", "true");
  });

  it("PQ5 — ArrowRight wraps from completed (last tab) back to pending", () => {
    render(<PayoutsQueue />);

    const [pending, completed] = screen.getAllByRole("tab");

    // Move to completed, then wrap around
    fireEvent.keyDown(pending, { key: "ArrowRight" });
    fireEvent.keyDown(completed, { key: "ArrowRight" });

    expect(pending).toHaveAttribute("aria-selected", "true");
    expect(completed).toHaveAttribute("aria-selected", "false");
  });

  it("PQ6 — tabIndex is 0 on the active tab and -1 on the inactive tab after navigation", () => {
    render(<PayoutsQueue />);

    const [pending, completed] = screen.getAllByRole("tab");
    fireEvent.keyDown(pending, { key: "ArrowRight" });

    expect(pending).toHaveAttribute("tabIndex", "-1");
    expect(completed).toHaveAttribute("tabIndex", "0");
  });

  it("PQ7 — clicking the completed tab directly updates selection", () => {
    render(<PayoutsQueue />);

    const [, completed] = screen.getAllByRole("tab");
    fireEvent.click(completed);

    expect(completed).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByRole("tab")[0]).toHaveAttribute("aria-selected", "false");
  });
});
