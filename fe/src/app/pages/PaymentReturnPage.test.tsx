import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CHECKOUT_RECOVERY_STORAGE_KEY } from "../../features/checkout";

const paymentStatusMock = vi.fn();
vi.mock("../lib/api/endpoints/payment", () => ({
  paymentStatus: (...args: unknown[]) => paymentStatusMock(...args),
}));

import { PaymentReturnPage } from "./PaymentReturnPage";

const paymentId = "11111111-1111-4111-8111-111111111111";
const orderKey = "22222222-2222-4222-8222-222222222222";
const paymentKey = "33333333-3333-4333-8333-333333333333";

function writeRedirectRecovery(provider: "VNPAY" | "MOMO" = "VNPAY") {
  sessionStorage.setItem(
    CHECKOUT_RECOVERY_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      phase: "redirect",
      provider,
      orderKey,
      paymentKey,
      cartFingerprint: "cart",
      orderId: "ORDER-456",
      paymentId,
      total: 123_000,
    }),
  );
}

function renderPage(initialEntries = [`/payment/return/vnpay?vnp_TxnRef=${paymentId}`]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/payment/return/:provider" element={<PaymentReturnPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  paymentStatusMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("PaymentReturnPage", () => {
  it("maps the validated VNPay reference to the recovered order ID", async () => {
    writeRedirectRecovery();
    paymentStatusMock.mockResolvedValueOnce({ status: "COMPLETED" });

    renderPage();

    await waitFor(() => expect(paymentStatusMock).toHaveBeenCalledWith("ORDER-456"));
    expect(sessionStorage.getItem(CHECKOUT_RECOVERY_STORAGE_KEY)).toBeNull();
  });

  it("rejects a provider or reference mismatch without polling", async () => {
    writeRedirectRecovery();
    renderPage(["/payment/return/momo?orderId=wrong-reference"]);

    await waitFor(() => expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("paymentReturn.error.title"));
    expect(paymentStatusMock).not.toHaveBeenCalled();
  });

  it("rejects missing or malformed recovery without guessing an order ID", async () => {
    sessionStorage.setItem(CHECKOUT_RECOVERY_STORAGE_KEY, "not-json");
    renderPage();

    await waitFor(() => expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("paymentReturn.error.title"));
    expect(paymentStatusMock).not.toHaveBeenCalled();
  });

  it.each(["COMPLETED", "FAILED", "PAYMENT_TIMEOUT"]) (
    "stops polling and clears recovery for %s",
    async (status) => {
      writeRedirectRecovery();
      paymentStatusMock.mockResolvedValueOnce({ status });

      renderPage();

      await waitFor(() => expect(paymentStatusMock).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(sessionStorage.getItem(CHECKOUT_RECOVERY_STORAGE_KEY)).toBeNull());
    },
  );
});
