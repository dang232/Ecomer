import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn<
  () => {
    ready: boolean;
    authenticated: boolean;
    profile: { id: string; email: string };
    roles: string[];
    refresh: () => Promise<void>;
  }
>();
const registerSellerMock =
  vi.fn<(input: { shopName: string; bankName: string }) => Promise<unknown>>();
const sellerProfileMock = vi.fn<() => Promise<unknown>>();
const refreshMock = vi.fn<() => Promise<void>>();

vi.mock("../hooks/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/shared/api/endpoints/users", () => ({
  registerSeller: (input: { shopName: string; bankName: string }) => registerSellerMock(input),
  sellerProfile: () => sellerProfileMock(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      let value = key;
      for (const [name, replacement] of Object.entries(opts ?? {})) {
        value = value.replaceAll(`{{${name}}}`, String(replacement));
      }
      return value;
    },
    i18n: { resolvedLanguage: "en" },
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { SellerRegisterPage } from "./SellerRegisterPage";

const SELLER_PROFILE = {
  id: "seller-1",
  shopName: "Moc Shop",
  bankName: "Vietcombank",
  approved: false,
  tier: "STANDARD",
  vacationMode: false,
  destination: null,
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/seller/register"]}>
        <SellerRegisterPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useAuthMock.mockReturnValue({
    ready: true,
    authenticated: true,
    profile: { id: "buyer-1", email: "buyer@example.com" },
    roles: ["BUYER"],
    refresh: () => refreshMock(),
  });
  registerSellerMock.mockReset();
  sellerProfileMock.mockReset();
  sellerProfileMock.mockRejectedValue(new Error("seller application not found"));
  refreshMock.mockReset();
  refreshMock.mockResolvedValue(undefined);
});

describe("SellerRegisterPage", () => {
  it("validates both required seller fields before making a request", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "sellerRegistration.submit" }));

    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(registerSellerMock).not.toHaveBeenCalled();
  });

  it("submits the backend contract and shows the pending application state", async () => {
    registerSellerMock.mockResolvedValueOnce(SELLER_PROFILE);
    renderPage();

    fireEvent.change(screen.getByLabelText("sellerRegistration.shopNameLabel"), {
      target: { value: "  Moc Shop  " },
    });
    fireEvent.change(screen.getByLabelText("sellerRegistration.bankNameLabel"), {
      target: { value: "  Vietcombank  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "sellerRegistration.submit" }));

    await waitFor(() => {
      expect(registerSellerMock).toHaveBeenCalledWith({
        shopName: "Moc Shop",
        bankName: "Vietcombank",
      });
    });
    expect(await screen.findByText("sellerRegistration.successTitle")).toBeInTheDocument();
    expect(screen.getByText("sellerRegistration.successStatus")).toBeInTheDocument();
    expect(screen.getByText("sellerRegistration.pendingNotice")).toBeInTheDocument();
  });

  it("loads the existing application instead of showing a second registration form", async () => {
    sellerProfileMock.mockReset();
    sellerProfileMock.mockResolvedValueOnce(SELLER_PROFILE);
    renderPage();

    expect(await screen.findByText("sellerRegistration.successTitle")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "sellerRegistration.submit" }),
    ).not.toBeInTheDocument();
    expect(registerSellerMock).not.toHaveBeenCalled();
  });

  it("refreshes the session after an existing application is approved", async () => {
    sellerProfileMock.mockReset();
    sellerProfileMock.mockResolvedValueOnce({ ...SELLER_PROFILE, approved: true });
    renderPage();

    expect(await screen.findByText("sellerRegistration.approvedTitle")).toBeInTheDocument();
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });
});
