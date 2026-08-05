import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryState = vi.hoisted(() => ({
  data: undefined as
    | {
        content: {
          id: string;
          shopName: string;
          description?: string | null;
          logoUrl?: string | null;
          tier: string;
          ratingAvg?: number | null;
          ratingCount: number;
          totalProducts: number;
        }[];
        number?: number;
        totalPages?: number;
        totalElements?: number;
      }
    | undefined,
  error: null as Error | null,
  isLoading: false,
  refetch: vi.fn(),
  page: undefined as number | undefined,
}));

vi.mock("../hooks/use-sellers", () => ({
  usePublicSellers: (page: number) => {
    queryState.page = page;
    return queryState;
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const defaults: Record<string, string> = {
        "publicSellers.title": "Find a seller",
        "publicSellers.description": "Browse verified shops on VNShop.",
        "publicSellers.loading": "Loading sellers...",
        "publicSellers.error": "Sellers could not be loaded.",
        "publicSellers.retry": "Try again",
        "publicSellers.emptyTitle": "No sellers yet",
        "publicSellers.emptyDescription": "Check back soon for verified shops.",
        "publicSellers.paginationLabel": "Seller list pagination",
        "publicSellers.previous": "Previous seller page",
        "publicSellers.next": "Next seller page",
        "publicSellers.page": "Page {{current}} of {{total}}",
        "publicSellers.rating": "{{rating}} ({{count}} ratings)",
        "publicSellers.products": "{{count}} products",
      };
      const value = defaults[key] ?? key;
      return value.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
        const option = options?.[name];
        return typeof option === "string" || typeof option === "number" ? String(option) : "";
      });
    },
  }),
}));

import { PublicSellersPage } from "./PublicSellersPage";

const SELLER = {
  id: "s1",
  shopName: "TechZone",
  description: "Best tech shop",
  logoUrl: "https://cdn/logo.png",
  tier: "PREMIUM",
  ratingAvg: 4.8,
  ratingCount: 320,
  totalProducts: 45,
};

function renderPage(entry = "/sellers") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <PublicSellersPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  queryState.data = undefined;
  queryState.error = null;
  queryState.isLoading = false;
  queryState.refetch.mockReset();
  queryState.page = undefined;
});

describe("PublicSellersPage", () => {
  it("renders public seller cards and pagination links", () => {
    queryState.data = {
      content: [SELLER],
      number: 1,
      totalPages: 3,
      totalElements: 25,
    };

    renderPage("/sellers?page=2");

    expect(screen.getByRole("heading", { name: "Find a seller" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /TechZone/ })).toHaveAttribute("href", "/sellers/s1");
    expect(screen.getByText("4.8 (320 ratings)")).toBeInTheDocument();
    expect(screen.getByText("45 products")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Seller list pagination" })).toBeInTheDocument();
    expect(queryState.page).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "Next seller page" }));
    expect(queryState.page).toBe(2);
  });

  it("renders a localized empty state", () => {
    queryState.data = { content: [], totalPages: 0, totalElements: 0 };

    renderPage();

    expect(screen.getByRole("status", { name: "No sellers yet" })).toBeInTheDocument();
    expect(screen.getByText("Check back soon for verified shops.")).toBeInTheDocument();
  });

  it("renders loading and retryable error states", () => {
    queryState.isLoading = true;
    renderPage();
    expect(screen.getByRole("status")).toHaveTextContent("Loading sellers...");

    queryState.isLoading = false;
    queryState.error = new Error("seller list unavailable");
    renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent("Sellers could not be loaded.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(queryState.refetch).toHaveBeenCalledTimes(1);
  });
});
