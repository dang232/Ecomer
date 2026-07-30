import { fireEvent, render, screen } from "@testing-library/react";
import type { HTMLAttributes, ReactNode } from "react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Payout } from "@/shared/api/endpoints/seller-finance";

type PayoutMutationInput = { amount: number; currency: string };

const mutationState = vi.hoisted(() => ({
  mutate: vi.fn<(input: PayoutMutationInput) => void>(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => ({ mutate: mutationState.mutate, isPending: false })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) =>
      createElement("div", props, children),
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));

vi.mock("@/shared/api/endpoints/seller-finance", () => ({
  requestPayout: vi.fn(),
}));

vi.mock("@tabler/icons-react", () => ({
  IconWalletOff: () => createElement("span", null, "off"),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { SellerWallet } from "./SellerWallet";

function makePayout({
  id,
  status,
  amount,
  ...overrides
}: Partial<Payout> & Pick<Payout, "id" | "status" | "amount">): Payout {
  return {
    sellerId: undefined,
    requestedAt: "2024-06-01T10:00:00Z",
    completedAt: undefined,
    currency: "VND",
    ...overrides,
    id,
    amount,
    status,
  };
}

const PAYOUTS: Payout[] = [
  makePayout({ id: "p-1", status: "PAID", amount: 100000 }),
  makePayout({ id: "p-2", status: "SUBMITTED", amount: 200000 }),
  makePayout({ id: "p-3", status: "REQUESTED", amount: 300000 }),
  makePayout({ id: "p-4", status: "FAILED", amount: 400000 }),
  makePayout({ id: "p-5", status: "REJECTED", amount: 500000 }),
  makePayout({ id: "p-6", status: "UNKNOWN", amount: 600000 }),
  makePayout({ id: "p-7", status: "REVERSED", amount: 700000 }),
];

function getRowCount(): number {
  const card = screen.getByText("seller.wallet.historyTitle").closest(".bg-card");
  return card?.querySelectorAll("[class*=border-t][class*=py-4]").length ?? 0;
}

describe("SellerWallet canonical payout history", () => {
  beforeEach(() => {
    mutationState.mutate.mockReset();
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "payout-key-test") });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows all payout rows", () => {
    render(<SellerWallet balance={1_000_000} payouts={PAYOUTS} isLoading={false} error={null} />);
    expect(getRowCount()).toBe(7);
  });

  it("filters paid rows without using legacy completed statuses", () => {
    render(<SellerWallet balance={1_000_000} payouts={PAYOUTS} isLoading={false} error={null} />);
    fireEvent.click(screen.getByRole("button", { name: "seller.wallet.historyFilter.paid" }));
    expect(getRowCount()).toBe(1);
  });

  it("filters active rows across requested, submitted, and unknown statuses", () => {
    render(<SellerWallet balance={1_000_000} payouts={PAYOUTS} isLoading={false} error={null} />);
    fireEvent.click(screen.getByRole("button", { name: "seller.wallet.historyFilter.active" }));
    expect(getRowCount()).toBe(3);
  });

  it("filters failed rows across failed, rejected, and reversed statuses", () => {
    render(<SellerWallet balance={1_000_000} payouts={PAYOUTS} isLoading={false} error={null} />);
    fireEvent.click(screen.getByRole("button", { name: "seller.wallet.historyFilter.failed" }));
    expect(getRowCount()).toBe(3);
  });

  it("has no destination field and reuses its idempotency key for a retry", () => {
    render(<SellerWallet balance={500000} payouts={[]} isLoading={false} error={null} />);

    fireEvent.click(screen.getByRole("button", { name: "seller.wallet.withdraw" }));
    expect(screen.queryByLabelText("seller.wallet.payoutDialog.bankLabel")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("seller.wallet.payoutDialog.amountLabel"), {
      target: { value: "100000" },
    });
    const submit = screen.getByRole("button", { name: "seller.wallet.payoutDialog.submit" });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(mutationState.mutate).toHaveBeenCalledTimes(2);
    const first = mutationState.mutate.mock.calls[0]?.[0];
    const second = mutationState.mutate.mock.calls[1]?.[0];
    expect(first).toMatchObject({ amount: 100000, currency: "VND" });
    expect(first).not.toHaveProperty("bankAccount");
    expect(second).toEqual(first);
  });
});
