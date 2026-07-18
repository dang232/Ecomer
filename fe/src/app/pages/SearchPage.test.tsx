import { fireEvent, render, screen } from "@testing-library/react";
import { type HTMLAttributes, type ReactNode, createElement } from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  catalogRefetch: vi.fn(),
  searchRefetch: vi.fn(),
  searchError: null as unknown,
  v2FetchNextPage: vi.fn(),
  v2HasNextPage: false,
  v2SearchData: undefined as
    | { pages: { data: { items: Record<string, unknown>[]; facets?: unknown } }[] }
    | undefined,
}));

vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) =>
      createElement("div", props, children),
    article: ({ children, ...props }: HTMLAttributes<HTMLElement> & { children?: ReactNode }) =>
      createElement("article", props, children),
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (typeof options?.defaultValue === "string") return options.defaultValue;
      return key;
    },
  }),
}));

vi.mock("../components/vnshop-context", () => ({
  useVNShop: () => ({
    toggleWishlist: vi.fn(),
    isWishlisted: () => false,
  }),
}));

vi.mock("../hooks/use-categories", () => ({
  categoryDisplayLabel: (category: { label?: string; name?: string; id: string }) =>
    category.label ?? category.name ?? category.id,
  useCategories: () => ({ data: [] }),
}));

vi.mock("../hooks/use-products", () => ({
  useProducts: () => ({
    data: [],
    isLoading: false,
    error: null,
    refetch: mocks.catalogRefetch,
  }),
}));

vi.mock("../hooks/use-search", () => ({
  useSearch: () => ({
    products: [],
    totalElements: 0,
    totalPages: 0,
    isLoading: false,
    error: mocks.searchError,
    refetch: mocks.searchRefetch,
  }),
}));

vi.mock("../hooks/use-search-facets", () => ({
  useSearchFacets: () => ({ facets: { categories: [], brands: [] } }),
}));

vi.mock("../hooks/use-search-v2", () => ({
  useSearchV2: () => ({
    data: mocks.v2SearchData,
    error: null,
    isLoading: false,
    hasNextPage: mocks.v2HasNextPage,
    isFetchingNextPage: false,
    fetchNextPage: mocks.v2FetchNextPage,
    refetch: vi.fn(),
  }),
}));

vi.mock("../hooks/use-products-v2", () => ({
  useProductsV2: () => ({
    data: undefined,
    error: null,
    isLoading: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  }),
}));

vi.mock("../lib/api/catalog-flags", () => ({ catalogV2Enabled: true }));

import { SearchPage } from "./SearchPage";

function renderPage(entry = "/search") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <SearchPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.catalogRefetch.mockReset();
  mocks.searchRefetch.mockReset();
  mocks.v2FetchNextPage.mockReset();
  mocks.v2HasNextPage = false;
  mocks.v2SearchData = undefined;
  mocks.searchError = null;
});

describe("SearchPage", () => {
  it("opens the shared filter controls in a mobile dialog", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Open filters" }));

    expect(screen.getByRole("dialog", { name: "Filters" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show results" })).toBeInTheDocument();
  });

  it("retries search and catalog requests after a blocking search failure", () => {
    mocks.searchError = new Error("search unavailable");
    renderPage("/search?q=phone");

    expect(screen.getByText("Products could not be loaded")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(mocks.searchRefetch).toHaveBeenCalledTimes(1);
    expect(mocks.catalogRefetch).toHaveBeenCalledTimes(1);
  });

  it("uses cursor results and loads the next page for supported v2 searches", () => {
    mocks.v2SearchData = {
      pages: [
        {
          data: {
            items: [
              {
                id: "product-1",
                name: "Phone",
                price: 100000,
                variants: [],
              },
            ],
          },
        },
      ],
    };
    mocks.v2HasNextPage = true;

    renderPage("/search?q=phone&sort=price-low");

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(mocks.v2FetchNextPage).toHaveBeenCalledTimes(1);
    expect(mocks.searchRefetch).not.toHaveBeenCalled();
  });
});
