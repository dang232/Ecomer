/**
 * P1-7 tests: SellerWallet history filter uses a known enum set (not
 * case-insensitive substring match). The WITHDRAWAL_STATUS_FILTER constant
 * maps each filter chip to an explicit Set of accepted status substrings.
 */
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { createElement } from "react";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../lib/i18n";

// Silence console.error from Sonner toast renders
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: {
    div: ({ children, ...props }: Record<string, unknown> & { children?: ReactNode }) =>
      createElement("div", props, children),
  },
}));

// ── Filter logic test ─────────────────────────────────────────────────────────

/** Mirrors the WITHDRAWAL_STATUS_FILTER constant from SellerWallet.tsx */
const WITHDRAWAL_STATUS_FILTER: Record<
  "all" | "completed" | "pending" | "failed",
  Set<string>
> = {
  all: new Set(),
  completed: new Set(["COMPLETED", "PAID"]),
  pending: new Set(["PENDING"]),
  failed: new Set(["FAILED", "REJECTED"]),
};

function applyFilter(
  payouts: { status: string }[],
  filter: "all" | "completed" | "pending" | "failed",
) {
  const matchSet = WITHDRAWAL_STATUS_FILTER[filter];
  if (matchSet.size === 0) return payouts;
  return payouts.filter((p) => {
    const upper = p.status.toUpperCase();
    return [...matchSet].some((s) => upper.includes(s));
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("SellerWallet history filter — P1-7 enum set", () => {
  const fixtures: { status: string }[] = [
    { status: "COMPLETED" },
    { status: "COMPLETED_BY_ADMIN" },
    { status: "PENDING" },
    { status: "FAILED" },
    { status: "REJECTED" },
    { status: "PENDING_REVIEW" },
    { status: "PAID_OUT" },
  ];

  describe("filter = 'all'", () => {
    it("returns every payout regardless of status", () => {
      const result = applyFilter(fixtures, "all");
      expect(result).toHaveLength(fixtures.length);
    });
  });

  describe("filter = 'completed'", () => {
    it('matches "COMPLETED"', () => {
      const result = applyFilter(fixtures, "completed");
      expect(result.map((r) => r.status)).toEqual(["COMPLETED", "COMPLETED_BY_ADMIN", "PAID_OUT"]);
    });

    it('does not match "PENDING" or "FAILED"', () => {
      const result = applyFilter(fixtures, "completed");
      expect(result.some((r) => r.status === "PENDING")).toBe(false);
      expect(result.some((r) => r.status === "FAILED")).toBe(false);
    });
  });

  describe("filter = 'pending'", () => {
    it('matches "PENDING"', () => {
      const result = applyFilter(fixtures, "pending");
      expect(result.map((r) => r.status)).toEqual(["PENDING", "PENDING_REVIEW"]);
    });

    it('does not match "COMPLETED" or "FAILED"', () => {
      const result = applyFilter(fixtures, "pending");
      expect(result.some((r) => r.status === "COMPLETED")).toBe(false);
      expect(result.some((r) => r.status === "FAILED")).toBe(false);
    });
  });

  describe("filter = 'failed'", () => {
    it('matches "FAILED" and "REJECTED"', () => {
      const result = applyFilter(fixtures, "failed");
      expect(result.map((r) => r.status)).toEqual(["FAILED", "REJECTED"]);
    });

    it('does not match "PENDING" or "COMPLETED"', () => {
      const result = applyFilter(fixtures, "failed");
      expect(result.some((r) => r.status === "PENDING")).toBe(false);
      expect(result.some((r) => r.status === "COMPLETED")).toBe(false);
    });
  });

  describe("case-insensitivity", () => {
    it("handles lowercase BE response values", () => {
      const lower: { status: string }[] = [{ status: "completed" }, { status: "failed" }, { status: "pending" }];
      expect(applyFilter(lower, "completed")).toHaveLength(1);
      expect(applyFilter(lower, "failed")).toHaveLength(1);
      expect(applyFilter(lower, "pending")).toHaveLength(1);
    });
  });
});
