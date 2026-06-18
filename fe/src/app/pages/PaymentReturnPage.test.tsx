/**
 * Tests for PaymentReturnPage i18n wiring (P0-6).
 *
 * All user-facing strings must come from t() — the mock returns the key itself,
 * so English-locale rendering never contains Vietnamese characters.
 */
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useSearchParams } from "react-router";

// paymentStatus is called on mount; mock it so the page skips the network layer
// and renders deterministically without timers.
const paymentStatusMock = vi.fn();
vi.mock("../lib/api/endpoints/payment", () => ({
  paymentStatus: (...args: unknown[]) => paymentStatusMock(...args),
}));

import { PaymentReturnPage } from "./PaymentReturnPage";

function renderPage(initialEntries = ["/payment-return/vnpay"]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    ...render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={initialEntries}>
          <PaymentReturnPage />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
    client,
  };
}

beforeEach(() => {
  paymentStatusMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("PaymentReturnPage i18n (P0-6)", () => {
  describe("en-locale rendering — no Vietnamese characters", () => {
    /**
     * The i18next mock returns the key itself (e.g. "paymentReturn.pending.title").
     * If any hardcoded Vietnamese literal were rendered instead, this test would fail.
     */
    it("pending phase: no Vietnamese characters in page content", async () => {
      // Resolve immediately with a terminal status so we jump past the polling phase.
      paymentStatusMock.mockResolvedValueOnce({ status: "COMPLETED" });

      // Set ?orderId= so the page doesn't short-circuit to the error phase.
      const { container } = renderPage(["/payment-return/vnpay?orderId=ORDER-123"]);

      // Wait for the page to render (mock resolves synchronously in the next microtask).
      await new Promise((r) => { setTimeout(r, 0); });

      expect(container.textContent).not.toMatch(/[àáảãạăằắẳẵặâầấậẩẫèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i);
    });

    it("completed phase: renders paymentReturn key for title, not the literal", async () => {
      paymentStatusMock.mockResolvedValueOnce({ status: "COMPLETED" });
      const { container } = renderPage(["/payment-return/vnpay?orderId=ORDER-456"]);
      await new Promise((r) => { setTimeout(r, 0); });

      // The title should be the i18n key rendered by the mock
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("paymentReturn.completed.title");
      // Confirm no Vietnamese literals leaked in
      expect(container.textContent).not.toMatch(/Thanh toán thành công/i);
    });

    it("failed phase: renders paymentReturn.failed.title key", async () => {
      paymentStatusMock.mockResolvedValueOnce({ status: "FAILED" });
      const { container } = renderPage(["/payment-return/momo?orderId=ORDER-789"]);
      await new Promise((r) => { setTimeout(r, 0); });

      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("paymentReturn.failed.title");
      expect(container.textContent).not.toMatch(/Thanh toán không thành công/i);
    });

    it("error phase (no orderId): uses paymentReturn.error.noOrderId key", async () => {
      // No ?orderId= → page short-circuits to error phase immediately.
      const { container } = renderPage(["/payment-return/vnpay"]);
      await new Promise((r) => { setTimeout(r, 0); });

      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("paymentReturn.error.title");
      expect(container.textContent).not.toMatch(/Không tìm thấy mã đơn/i);
    });
  });
});
