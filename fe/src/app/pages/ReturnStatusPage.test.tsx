/** Tests for ReturnStatusPage - simplified */
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { createElement } from "react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: {
    div: ({ children, ...props }: any) => createElement("div", props, children),
  },
}));

vi.mock("@/shared/api/endpoints/returns", () => ({
  listReturns: vi.fn().mockResolvedValue([]),
  getReturn: vi.fn(),
  approveReturn: vi.fn(),
  rejectReturn: vi.fn(),
  completeReturn: vi.fn(),
  openDispute: vi.fn(),
}));

vi.mock("@/shared/api", () => ({
  ApiError: class ApiError extends Error {
    constructor(public message: string) {
      super(message);
    }
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: "en" },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  queryOptions: (opts: any) => opts,
  useQuery: vi.fn().mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
  }),
  useMutation: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  }),
  useQueryClient: vi.fn().mockReturnValue({ invalidateQueries: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { ReturnStatusPage } from "./ReturnStatusPage";

describe("ReturnStatusPage", () => {
  it("renders the page title", () => {
    render(
      <MemoryRouter>
        <ReturnStatusPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("return.status.title")).toBeInTheDocument();
  });

  it("shows empty state when no returns", () => {
    render(
      <MemoryRouter>
        <ReturnStatusPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("return.status.empty")).toBeInTheDocument();
  });

  it("shows back link to orders page", () => {
    render(
      <MemoryRouter>
        <ReturnStatusPage />
      </MemoryRouter>,
    );
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "/orders");
  });
});
