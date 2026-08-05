import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { createElement } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WalletView } from "../model/wallet-view";

import { WalletPage } from "./wallet-page";

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("react-router", () => ({
  MemoryRouter: ({ children }: { children: ReactNode }) => children,
  useSearchParams: vi.fn(() => {
    const params = new URLSearchParams();
    const get = vi.fn(() => params.get("filter") ?? "all");
    const set = vi.fn((_key: string, value: string) => {
      params.set("filter", value);
    });

    return [{ get }, { set }] as [{ get: typeof get }, { set: typeof set }];
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

vi.mock("lucide-react", () => ({
  AlertCircle: () => createElement("span", null, "alert"),
  CheckCircle2: () => createElement("span", null, "success"),
  Info: () => createElement("span", null, "info"),
  TriangleAlert: () => createElement("span", null, "warning"),
  WalletMinimal: () => createElement("span", null, "off"),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeView(overrides?: Partial<WalletView>): WalletView {
  return {
    availableVnd: 500_000,
    pendingBalanceVnd: 75_000,
    activePayoutVnd: 0,
    canRequestPayout: true,
    history: [],
    ...overrides,
  };
}

describe("WalletPage filter chips use URL search params", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "test-key") });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to all filter and renders all rows", () => {
    renderWithRouter(
      <WalletPage
        view={makeView({
          history: [
            { id: "p-1", amountVnd: 100_000, status: "PAID", requestedAt: "2024-07-01T00:00:00Z" },
            {
              id: "p-2",
              amountVnd: 200_000,
              status: "FAILED",
              requestedAt: "2024-07-01T00:00:00Z",
            },
          ],
        })}
        onRequestPayout={vi.fn()}
      />,
    );

    // Both rows visible at filter=all
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(2);
  });
});
