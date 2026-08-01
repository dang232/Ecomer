import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const noop = () => undefined;

type UnknownCall = (...args: unknown[]) => unknown;

const paypalCreateMock = vi.fn<UnknownCall>();
const paypalCaptureMock = vi.fn<UnknownCall>();
vi.mock("@/shared/api/endpoints/payment", () => ({
  paypalCreate: (...args: unknown[]) => paypalCreateMock(...args),
  paypalCapture: (...args: unknown[]) => paypalCaptureMock(...args),
}));

const toastErrorMock = vi.fn<(message: string) => void>();
vi.mock("sonner", () => ({
  toast: { error: (message: string) => toastErrorMock(message) },
}));

// Stub the PayPal SDK so the test never reaches paypal.com. The Buttons stub
// captures createOrder/onApprove/onError as test-driveable callbacks via
// data-* attributes on a placeholder div.
type Captured = {
  createOrder?: () => Promise<string>;
  onApprove?: (data: { orderID: string }) => Promise<void>;
  onError?: (err: unknown) => void;
};
const captured: Captured = {};
vi.mock("@paypal/react-paypal-js", () => ({
  PayPalScriptProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  PayPalButtons: (props: Captured) => {
    captured.createOrder = props.createOrder;
    captured.onApprove = props.onApprove;
    captured.onError = props.onError;
    return <div data-testid="paypal-buttons-stub" />;
  },
}));

import { PayPalPaymentSection } from "./PayPalPaymentSection";

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  paypalCreateMock.mockReset();
  paypalCaptureMock.mockReset();
  toastErrorMock.mockReset();
  captured.createOrder = undefined;
  captured.onApprove = undefined;
  captured.onError = undefined;
  vi.stubEnv("VITE_PAYPAL_ENABLED", "true");
  vi.stubEnv("VITE_PAYPAL_CLIENT_ID", "sb-test-client-id");
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("PayPalPaymentSection", () => {
  it("createOrder calls /paypal/create and returns the paypalOrderId for the SDK", async () => {
    paypalCreateMock.mockResolvedValueOnce({
      payment: { paymentId: "pay-uuid-1", status: "PENDING" },
      paypalOrderId: "PAYPAL-ORDER-ABC",
      clientId: "sb-test-client-id",
      status: "CREATED",
    });
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <PayPalPaymentSection orderId="ORDER-1" idempotencyKey="idem-1" onCompleted={noop} />
      </Wrapper>,
    );
    await waitFor(() => expect(captured.createOrder).toBeDefined());

    const result = await captured.createOrder!();

    expect(paypalCreateMock).toHaveBeenCalledWith({ orderId: "ORDER-1" }, "idem-1");
    expect(result).toBe("PAYPAL-ORDER-ABC");
  });

  it("onApprove calls /paypal/capture with the captured paymentId and fires onCompleted", async () => {
    paypalCreateMock.mockResolvedValueOnce({
      payment: { paymentId: "pay-uuid-2", status: "PENDING" },
      paypalOrderId: "PAYPAL-ORDER-XYZ",
      clientId: "sb-test-client-id",
      status: "CREATED",
    });
    paypalCaptureMock.mockResolvedValueOnce({
      payment: { paymentId: "pay-uuid-2", status: "COMPLETED" },
    });
    const onCompleted = vi.fn();
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <PayPalPaymentSection orderId="ORDER-1" idempotencyKey="idem-1" onCompleted={onCompleted} />
      </Wrapper>,
    );
    await waitFor(() => expect(captured.createOrder).toBeDefined());
    await act(async () => {
      await captured.createOrder!();
    });

    await act(async () => {
      await captured.onApprove!({ orderID: "PAYPAL-ORDER-XYZ" });
    });

    expect(paypalCaptureMock).toHaveBeenCalledWith("pay-uuid-2", "PAYPAL-ORDER-XYZ");
    expect(onCompleted).toHaveBeenCalledOnce();
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("onApprove surfaces a capture failure as an error toast and inline banner", async () => {
    paypalCreateMock.mockResolvedValueOnce({
      payment: { paymentId: "pay-uuid-3", status: "PENDING" },
      paypalOrderId: "PAYPAL-ORDER-FAIL",
      clientId: "sb-test-client-id",
      status: "CREATED",
    });
    paypalCaptureMock.mockRejectedValueOnce(new Error("capture exploded"));
    const onCompleted = vi.fn();
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <PayPalPaymentSection orderId="ORDER-1" idempotencyKey="idem-1" onCompleted={onCompleted} />
      </Wrapper>,
    );
    await waitFor(() => expect(captured.createOrder).toBeDefined());
    await act(async () => {
      await captured.createOrder!();
    });

    await act(async () => {
      await captured.onApprove!({ orderID: "PAYPAL-ORDER-FAIL" });
    });

    expect(toastErrorMock).toHaveBeenCalledWith("capture exploded");
    expect(onCompleted).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText("capture exploded")).toBeInTheDocument());
  });

  it("onApprove guards against being called before createOrder set the paymentId", async () => {
    const onCompleted = vi.fn();
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <PayPalPaymentSection orderId="ORDER-1" idempotencyKey="idem-1" onCompleted={onCompleted} />
      </Wrapper>,
    );
    await waitFor(() => expect(captured.onApprove).toBeDefined());

    await act(async () => {
      await captured.onApprove!({ orderID: "PAYPAL-ORDER-EARLY" });
    });

    expect(paypalCaptureMock).not.toHaveBeenCalled();
    expect(onCompleted).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText("missing payment id")).toBeInTheDocument());
  });
});
