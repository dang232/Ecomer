import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) =>
      createElement("div", props, children as ReactNode),
  },
}));

const listSellerReturnsMock = vi.fn();
const approveReturnMock = vi.fn();
const rejectReturnMock = vi.fn();
const completeReturnMock = vi.fn();

vi.mock("@/shared/api/endpoints/returns", () => ({
  listSellerReturns: (args: unknown) => listSellerReturnsMock(args) as Promise<unknown>,
  approveReturn: (id: unknown) => approveReturnMock(id) as Promise<unknown>,
  rejectReturn: (id: unknown) => rejectReturnMock(id) as Promise<unknown>,
  completeReturn: (id: unknown) => completeReturnMock(id) as Promise<unknown>,
}));

vi.mock("@/shared/api", () => ({
  ApiError: class ApiError extends Error {
    constructor(message: string) {
      super(message);
    }
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      let value = typeof opts?.defaultValue === "string" ? opts.defaultValue : key;
      for (const [name, replacement] of Object.entries(opts ?? {})) {
        if (name !== "defaultValue") {
          value = value.replaceAll(`{{${name}}}`, String(replacement));
        }
      }
      return value;
    },
    i18n: { resolvedLanguage: "en" },
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { SellerReturns } from "./SellerReturns";

function renderWithProviders(ui: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const fixtureReturn = {
  id: "ret-001",
  orderId: "ord-1",
  subOrderId: 12,
  buyerId: "buyer-1",
  reason: "damaged",
  status: "REQUESTED" as const,
  requestedAt: "2026-07-22T00:00:00Z",
  resolvedAt: null,
};

describe("SellerReturns", () => {
  beforeEach(() => {
    listSellerReturnsMock.mockReset();
    approveReturnMock.mockReset();
    rejectReturnMock.mockReset();
    completeReturnMock.mockReset();
    approveReturnMock.mockResolvedValue({ ...fixtureReturn, status: "APPROVED" });
    rejectReturnMock.mockResolvedValue({ ...fixtureReturn, status: "REJECTED" });
    completeReturnMock.mockResolvedValue({ ...fixtureReturn, status: "COMPLETED" });
  });

  it("renders empty state when no returns exist", async () => {
    listSellerReturnsMock.mockResolvedValueOnce([]);
    renderWithProviders(<SellerReturns />);

    await waitFor(() => {
      expect(screen.getByText("return.seller.empty")).toBeInTheDocument();
    });
  });

  it("approves a pending return", async () => {
    listSellerReturnsMock.mockResolvedValueOnce([fixtureReturn]);
    renderWithProviders(<SellerReturns />);

    const approveButton = await screen.findByRole("button", { name: /return\.seller\.approve/i });
    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(approveReturnMock).toHaveBeenCalledWith("ret-001");
    });
  });

  it("rejects a pending return without collecting or sending a reason", async () => {
    listSellerReturnsMock.mockResolvedValueOnce([fixtureReturn]);
    renderWithProviders(<SellerReturns />);

    const rejectButton = await screen.findByRole("button", { name: /return\.seller\.reject/i });
    fireEvent.click(rejectButton);

    expect(
      screen.queryByPlaceholderText(/rejectDialog\.reasonPlaceholder/i),
    ).not.toBeInTheDocument();

    const submit = screen.getByRole("button", { name: /rejectDialog\.submitLabel/i });
    fireEvent.click(submit);

    await waitFor(() => {
      expect(rejectReturnMock).toHaveBeenCalledWith("ret-001");
    });
  });

  it("completes an approved return", async () => {
    listSellerReturnsMock.mockResolvedValueOnce([{ ...fixtureReturn, status: "APPROVED" }]);
    renderWithProviders(<SellerReturns />);

    // Default tab is "pending"; APPROVED items are hidden there. Switch tabs.
    const approvedTab = await screen.findByRole("tab", {
      name: /return\.status\.approved/i,
    });
    fireEvent.click(approvedTab);

    const completeButton = await screen.findByRole("button", {
      name: /return\.seller\.complete/i,
    });
    fireEvent.click(completeButton);

    await waitFor(() => {
      expect(completeReturnMock).toHaveBeenCalledWith("ret-001");
    });
  });
});
