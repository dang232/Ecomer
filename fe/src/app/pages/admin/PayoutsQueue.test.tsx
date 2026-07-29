import { fireEvent, render, screen } from "@testing-library/react";
import type { HTMLAttributes, ReactNode } from "react";
import { createElement as h } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { adminPayoutSchema, type AdminPayout } from "../../types/api";

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) =>
      h("div", props, children),
  },
}));

const pendingData = vi.fn(() => ({
  data: [] as AdminPayout[],
  isLoading: false,
  isError: false,
}));
const completedData = vi.fn(() => ({
  data: [] as AdminPayout[],
  isLoading: false,
  isError: false,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: readonly string[] }) => {
    const key = queryKey[2];
    if (key === "requested") return pendingData();
    if (key === "paid") return completedData();
    return { data: undefined, isLoading: false, isError: false };
  },
  useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));

vi.mock("../../lib/api/endpoints/admin", () => ({
  adminPendingPayouts: vi.fn(),
  adminCompletedPayouts: vi.fn(),
  adminCompletePayout: vi.fn(),
  adminFailPayout: vi.fn(),
}));

vi.mock("@tabler/icons-react", () => ({
  IconArrowsSort: () => h("span", null, "sort"),
  IconSearch: () => h("span", null, "search"),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { PayoutsQueue } from "./PayoutsQueue";

function makeAdminPayout(overrides: Partial<AdminPayout> = {}): AdminPayout {
  return adminPayoutSchema.parse({
    id: "payout-1",
    sellerId: "seller-001",
    sellerName: "Test Seller",
    amount: 100_000,
    status: "REQUESTED",
    requestedAt: "2024-06-01T10:00:00Z",
    completedBy: undefined,
    completedAt: undefined,
    currency: "VND",
    ...overrides,
  });
}

describe("PayoutsQueue canonical payout contract", () => {
  beforeEach(() => {
    pendingData.mockImplementation(() => ({
      data: [] as AdminPayout[],
      isLoading: false,
      isError: false,
    }));
    completedData.mockImplementation(() => ({
      data: [] as AdminPayout[],
      isLoading: false,
      isError: false,
    }));
  });

  it("renders canonical status values in the requested queue", () => {
    pendingData.mockReturnValue({
      data: [makeAdminPayout({ status: "UNKNOWN" })],
      isLoading: false,
      isError: false,
    });

    render(<PayoutsQueue />);

    expect(screen.getByText("UNKNOWN")).toBeInTheDocument();
    expect(screen.queryByText("PENDING")).not.toBeInTheDocument();
    expect(screen.queryByText("COMPLETED")).not.toBeInTheDocument();
  });

  it("renders both canonical queue tabs with requested selected by default", () => {
    render(<PayoutsQueue />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveAttribute("aria-selected", "false");
  });

  it("moves focus selection with ArrowRight and wraps with ArrowLeft", () => {
    render(<PayoutsQueue />);

    const [requested, paid] = screen.getAllByRole("tab");
    fireEvent.keyDown(requested, { key: "ArrowRight" });
    expect(paid).toHaveAttribute("aria-selected", "true");
    expect(requested).toHaveAttribute("tabIndex", "-1");

    fireEvent.keyDown(paid, { key: "ArrowLeft" });
    expect(requested).toHaveAttribute("aria-selected", "true");
  });

  it("opens the guarded manual payment evidence form", () => {
    pendingData.mockReturnValue({
      data: [makeAdminPayout()],
      isLoading: false,
      isError: false,
    });

    render(<PayoutsQueue />);
    fireEvent.click(screen.getByRole("button", { name: "admin.payouts.recordPayment" }));

    expect(screen.getByLabelText("admin.payouts.completeDialog.reasonLabel")).toBeInTheDocument();
    expect(
      screen.getByLabelText("admin.payouts.completeDialog.externalReferenceLabel"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("admin.payouts.completeDialog.evidenceHashLabel"),
    ).toBeInTheDocument();
  });
});
