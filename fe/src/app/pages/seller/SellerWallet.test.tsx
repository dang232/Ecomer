/**
 * P1-7 tests: SellerWallet history filter uses a known enum set.
 * Tests render the REAL SellerWallet component with controlled props;
 * the component's own WITHDRAWAL_STATUS_FILTER drives the filtering.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import type { HTMLAttributes, ReactNode } from "react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

import type { Payout } from "../../lib/api/endpoints/seller-finance";

// ── Mock tanstack/react-query ────────────────────────────────────────────────

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

// ── Mock AnimatePresence so FormDialog renders synchronously in jsdom ────────

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) =>
      createElement("div", props, children),
  },
}));

// ── Mock i18n — return the key itself ───────────────────────────────────────

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));

// ── Mock API endpoint (unused but imported by component) ─────────────────────

vi.mock("../../lib/api/endpoints/seller-finance", () => ({
  requestPayout: vi.fn(),
}));

// ── Mock tabler icons ─────────────────────────────────────────────────────────

vi.mock("@tabler/icons-react", () => ({
  IconWalletOff: () => createElement("span", null, "off"),
}));

// ── Mock sonner toast ─────────────────────────────────────────────────────────

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// ── Component under test ─────────────────────────────────────────────────────

import { SellerWallet } from "./SellerWallet";

// ── Fixture helpers ───────────────────────────────────────────────────────────

/** Payout fixture with required fields for SellerWallet rendering. */
function makePayout(
  overrides: Partial<Payout> & { id: string; status: string; amount: number },
): Payout {
  const defaults = {
    id: "",
    sellerId: undefined as Payout["sellerId"],
    amount: 0,
    status: "PENDING",
    requestedAt: "2024-06-01T10:00:00Z",
    completedAt: undefined,
    bankAccount: undefined,
  };
  return { ...defaults, ...overrides } as Payout;
}

/** All 7 statuses from the original test fixture. */
const SEVEN_FIXTURES: Payout[] = [
  makePayout({ id: "p-1", status: "COMPLETED", amount: 100000 }),
  makePayout({ id: "p-2", status: "COMPLETED_BY_ADMIN", amount: 200000 }),
  makePayout({ id: "p-3", status: "PENDING", amount: 300000 }),
  makePayout({ id: "p-4", status: "FAILED", amount: 400000 }),
  makePayout({ id: "p-5", status: "REJECTED", amount: 500000 }),
  makePayout({ id: "p-6", status: "PENDING_REVIEW", amount: 600000 }),
  makePayout({ id: "p-7", status: "PAID_OUT", amount: 700000 }),
];

/**
 * Count payout rows by their distinctive border class.
 * - Payout rows: `border-t border-gray-50`  (every payout row)
 * - Section headers: `bg-muted/40`          (distinct bg colour)
 * - History header: `border-b border-border` (top border, no py-4)
 *
 * Payout rows are the only elements inside the card body that carry
 * `border-t`. Filter by `py-4` padding too to be defensive against
 * any future additions that only carry `border-t`.
 */
function getRowCount(): number {
  const card = screen.getByText("seller.wallet.historyTitle").closest(".bg-card");
  if (!card) return 0;
  return card.querySelectorAll("[class*=border-t][class*=py-4]").length;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("SellerWallet history filter — P1-7 enum set", () => {
  it("SW1 — Filter 'all': all 7 payouts are visible", () => {
    render(
      <SellerWallet balance={1_000_000} payouts={SEVEN_FIXTURES} isLoading={false} error={null} />,
    );

    expect(screen.getByText("seller.wallet.historyTitle")).toBeInTheDocument();
    expect(getRowCount()).toBe(7);
  });

  it("SW2 — Filter 'completed': only COMPLETED, COMPLETED_BY_ADMIN, PAID_OUT rows appear", () => {
    render(
      <SellerWallet balance={1_000_000} payouts={SEVEN_FIXTURES} isLoading={false} error={null} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "seller.wallet.historyFilter.completed" }));
    expect(getRowCount()).toBe(3);
  });

  it("SW2 — Filter 'completed' does NOT include PENDING or FAILED rows", () => {
    render(
      <SellerWallet balance={1_000_000} payouts={SEVEN_FIXTURES} isLoading={false} error={null} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "seller.wallet.historyFilter.completed" }));
    expect(getRowCount()).toBe(3); // PENDING, FAILED, REJECTED, PENDING_REVIEW are absent
  });

  it("SW3 — Filter 'pending': only PENDING and PENDING_REVIEW rows appear", () => {
    render(
      <SellerWallet balance={1_000_000} payouts={SEVEN_FIXTURES} isLoading={false} error={null} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "seller.wallet.historyFilter.pending" }));
    expect(getRowCount()).toBe(2);
  });

  it("SW3 — Filter 'pending' does NOT include COMPLETED or FAILED rows", () => {
    render(
      <SellerWallet balance={1_000_000} payouts={SEVEN_FIXTURES} isLoading={false} error={null} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "seller.wallet.historyFilter.pending" }));
    expect(getRowCount()).toBe(2); // COMPLETED, FAILED, REJECTED absent
  });

  it("SW4 — Filter 'failed': only FAILED and REJECTED rows appear", () => {
    render(
      <SellerWallet balance={1_000_000} payouts={SEVEN_FIXTURES} isLoading={false} error={null} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "seller.wallet.historyFilter.failed" }));
    expect(getRowCount()).toBe(2);
  });

  it("SW4 — Filter 'failed' does NOT include COMPLETED or PENDING rows", () => {
    render(
      <SellerWallet balance={1_000_000} payouts={SEVEN_FIXTURES} isLoading={false} error={null} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "seller.wallet.historyFilter.failed" }));
    expect(getRowCount()).toBe(2); // COMPLETED, PENDING, PENDING_REVIEW absent
  });

  it("SW5 — Empty filtered state: clicking 'completed' with zero COMPLETED payouts shows empty message", () => {
    const noCompleted: Payout[] = [
      makePayout({ id: "x1", status: "PENDING", amount: 100000 }),
      makePayout({ id: "x2", status: "FAILED", amount: 200000 }),
    ];

    render(<SellerWallet balance={500000} payouts={noCompleted} isLoading={false} error={null} />);

    fireEvent.click(screen.getByRole("button", { name: "seller.wallet.historyFilter.completed" }));
    expect(getRowCount()).toBe(0);
    expect(screen.getByText("seller.wallet.historyEmpty")).toBeInTheDocument();
  });

  it("SW6 — Case-insensitivity: lowercase status values still match the completed filter", () => {
    const lower: Payout[] = [
      makePayout({ id: "l1", status: "completed", amount: 100000 }),
      makePayout({ id: "l2", status: "paid_out", amount: 200000 }),
    ];

    render(<SellerWallet balance={500000} payouts={lower} isLoading={false} error={null} />);

    fireEvent.click(screen.getByRole("button", { name: "seller.wallet.historyFilter.completed" }));
    expect(getRowCount()).toBe(2);
  });
});
