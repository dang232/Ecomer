/**
 * Tests for VietQrPaymentSection i18n wiring (P0-6).
 *
 * All user-facing strings must come from t() — the mock returns the key itself,
 * so English-locale rendering never contains Vietnamese characters.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- API stubs ---
const paymentStatusMock = vi.fn();
const vietqrCreateMock = vi.fn();
vi.mock("../../lib/api/endpoints/payment", () => ({
  paymentStatus: (...args: unknown[]) => paymentStatusMock(...args),
  vietqrCreate: (...args: unknown[]) => vietqrCreateMock(...args),
}));

import { VietQrPaymentSection } from "./VietQrPaymentSection";

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  vietqrCreateMock.mockReset();
  paymentStatusMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("VietQrPaymentSection i18n (P0-6)", () => {
  it("loading state renders t('vietqr.creating') key — no hardcoded Vietnamese", async () => {
    // Never resolve the QR so the component stays in loading state.
    vietqrCreateMock.mockImplementation(() => new Promise(() => {}));
    const Wrapper = makeWrapper();
    const { container } = render(
      <Wrapper>
        <VietQrPaymentSection orderId="ORDER-1" idempotencyKey="idem-1" onCompleted={vi.fn()} />
      </Wrapper>,
    );

    // The loading state shows the creating message.
    await waitFor(() => {
      expect(screen.queryByTestId("vietqr-section")).not.toBeInTheDocument();
    });

    // Must be the i18n key, not "Đang tạo QR…"
    expect(screen.getByText("vietqr.creating")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/[àáảãạăằắẳẵặâầấậẩẫèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i);
  });

  it("QR loaded state: account label uses t('vietqr.accountLabel') key — no 'Tài khoản:' literal", async () => {
    vietqrCreateMock.mockResolvedValueOnce({
      qrImageUrl: "https://example.com/qr.png",
      accountNo: "123456789",
      accountName: "VNShop",
      reference: "REF123",
    });
    // Payment status never resolves (no COMPLETED), so the component stays on the QR view.
    paymentStatusMock.mockImplementation(() => new Promise(() => {}));

    const Wrapper = makeWrapper();
    const { container } = render(
      <Wrapper>
        <VietQrPaymentSection orderId="ORDER-1" idempotencyKey="idem-1" onCompleted={vi.fn()} />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("vietqr-section")).toBeInTheDocument();
    });

    // Should use the i18n key, not the hardcoded Vietnamese label.
    expect(screen.getByText("vietqr.accountLabel")).toBeInTheDocument();
    expect(screen.getByText("vietqr.nameLabel")).toBeInTheDocument();
    expect(screen.getByText("vietqr.referenceLabel")).toBeInTheDocument();
    expect(screen.getByText("vietqr.autoUpdate")).toBeInTheDocument();
    expect(screen.getByTestId("vietqr-image")).toHaveAttribute("alt", "vietqr.altText");

    // Confirm no hardcoded Vietnamese leaked through.
    expect(container.textContent).not.toMatch(/Tài khoản:/i);
    expect(container.textContent).not.toMatch(/Nội dung CK:/i);
    expect(container.textContent).not.toMatch(/Sau khi chuyển xong/i);
  });

  it("QR loaded state: no Vietnamese characters anywhere in rendered content", async () => {
    vietqrCreateMock.mockResolvedValueOnce({
      qrImageUrl: "https://example.com/qr.png",
      accountNo: "987654321",
      accountName: "VNShop Seller",
      reference: "REF-456",
    });
    paymentStatusMock.mockImplementation(() => new Promise(() => {}));

    const Wrapper = makeWrapper();
    const { container } = render(
      <Wrapper>
        <VietQrPaymentSection orderId="ORDER-1" idempotencyKey="idem-1" onCompleted={vi.fn()} />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("vietqr-section")).toBeInTheDocument();
    });

    // Comprehensive check: no Vietnamese diacritic characters at all.
    expect(container.textContent).not.toMatch(/[àáảãạăằắẳẵặâầấậẩẫèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i);
  });
});
