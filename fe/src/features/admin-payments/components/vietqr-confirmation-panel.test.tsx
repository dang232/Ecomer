import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/api/endpoints/admin", () => ({
  adminConfirmVietQr: vi.fn().mockResolvedValue({ paymentId: "pmt-1" }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string; paymentId?: string }) => {
      const dict: Record<string, string> = {
        "admin.payments.vietqr.panelTitle": "Confirm VietQR payment",
        "admin.payments.vietqr.panelSubtitle": "Payment: {{paymentId}}",
        "admin.payments.vietqr.bankReference": "Bank reference (optional)",
        "admin.payments.vietqr.bankReferenceHelp": "Help text",
        "admin.payments.vietqr.confirm": "Confirm payment",
        "admin.payments.vietqr.confirmOk": "VietQR payment confirmed",
      };
      const raw = dict[key] ?? opts?.defaultValue ?? key;
      return raw.replace(/\{\{(\w+)\}\}/g, (_m, k: string) =>
        opts && k in opts ? String(opts[k as keyof typeof opts]) : `{{${k}}}`,
      );
    },
    i18n: { language: "en" },
  }),
}));

import { adminConfirmVietQr } from "@/shared/api/endpoints/admin";

import { VietqrConfirmationPanel } from "./vietqr-confirmation-panel";

const PAYMENT_UUID = "2fa79e15-2e29-4b94-903e-15cc20fe36dc";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={makeQueryClient()}>{children}</QueryClientProvider>;
}

describe("VietqrConfirmationPanel", () => {
  it("renders with the payment id in the subtitle", () => {
    render(
      <TestWrapper>
        <VietqrConfirmationPanel paymentId={PAYMENT_UUID} />
      </TestWrapper>,
    );
    expect(screen.getByText(`Payment: ${PAYMENT_UUID}`)).toBeInTheDocument();
  });

  it("blocks submit when paymentId is not a UUID", async () => {
    render(
      <TestWrapper>
        <VietqrConfirmationPanel paymentId="not-a-uuid" />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText("Confirm payment"));
    await waitFor(() => {
      expect(adminConfirmVietQr).not.toHaveBeenCalled();
    });
    expect(screen.getByText(/UUID/)).toBeInTheDocument();
  });

  it("calls adminConfirmVietQr with empty body when bank reference is blank", async () => {
    render(
      <TestWrapper>
        <VietqrConfirmationPanel paymentId={PAYMENT_UUID} />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText("Confirm payment"));
    await waitFor(() => {
      expect(adminConfirmVietQr).toHaveBeenCalledWith(PAYMENT_UUID, {});
    });
  });

  it("calls adminConfirmVietQr with trimmed bank reference when provided", async () => {
    const onConfirmed = vi.fn();
    render(
      <TestWrapper>
        <VietqrConfirmationPanel paymentId={PAYMENT_UUID} onConfirmed={onConfirmed} />
      </TestWrapper>,
    );
    fireEvent.change(screen.getByLabelText("Bank reference (optional)"), {
      target: { value: "  BANK-1  " },
    });
    fireEvent.click(screen.getByText("Confirm payment"));
    await waitFor(() => {
      expect(adminConfirmVietQr).toHaveBeenCalledWith(PAYMENT_UUID, {
        bankReference: "BANK-1",
      });
      expect(onConfirmed).toHaveBeenCalledWith("BANK-1");
    });
  });
});
