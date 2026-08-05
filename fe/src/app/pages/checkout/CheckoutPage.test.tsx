import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { CheckoutPage } from "./CheckoutPage";

const queryClient = new QueryClient();

// Stable mock controller state
const mockState = { status: "draft" as const, orderKey: "key-1", cartFingerprint: "" };
const mockSubscribe = vi.fn(() => vi.fn());
const mockGetState = vi.fn(() => mockState);

vi.mock("../../../features/checkout", () => ({
  createCheckoutRecoveryStore: () => ({ read: vi.fn(), write: vi.fn(), clear: vi.fn() }),
  createCheckoutSubmissionController: vi.fn(() => ({
    getState: mockGetState,
    subscribe: mockSubscribe,
    updateCartFingerprint: vi.fn(),
    submit: vi.fn(),
    resume: vi.fn(),
  })),
}));

vi.mock("../../../shared/api", () => ({
  ApiError: class extends Error {
    constructor(public override message: string) {
      super(message);
    }
  },
}));

vi.mock("@/shared/api/endpoints/checkout", () => ({
  calculateCheckout: vi.fn(),
  fetchShippingRates: vi.fn(),
  paymentMethods: vi.fn(),
  shippingOptions: vi.fn(),
}));

vi.mock("@/shared/api/endpoints/coupons", () => ({
  listActiveCoupons: vi.fn(),
  validateCouponCode: vi.fn(),
}));

vi.mock("@/shared/api/endpoints/orders", () => ({
  findOrderByIdempotencyKey: vi.fn(),
  placeOrder: vi.fn(),
}));

vi.mock("@/shared/api/endpoints/payment", () => ({
  codConfirm: vi.fn(),
  momoCreate: vi.fn(),
  paypalCreate: vi.fn(),
  stripeCreate: vi.fn(),
  vietqrCreate: vi.fn(),
  vnpayCreate: vi.fn(),
}));

vi.mock("@/shared/api/endpoints/users", () => ({
  myProfile: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) => options?.count?.toString() ?? key,
  }),
}));

vi.mock("../../hooks/auth-context", () => ({
  useAuth: () => ({
    ready: true,
    authenticated: false,
    login: vi.fn(),
    profile: null,
  }),
}));

vi.mock("../../hooks/use-cart", () => ({
  useCart: () => ({
    items: [],
    totalAmount: 0,
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("CheckoutPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscribe.mockClear();
    mockGetState.mockClear();
  });

  it("shows login prompt when user is not authenticated", () => {
    render(
      <TestWrapper>
        <CheckoutPage />
      </TestWrapper>,
    );

    expect(screen.getByText("checkout.loginPromptTitle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /auth\.login/i })).toBeInTheDocument();
  });
});
