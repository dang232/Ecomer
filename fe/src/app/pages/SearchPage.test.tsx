import { fireEvent, render, screen } from "@testing-library/react";
import { type HTMLAttributes, type ReactNode, createElement } from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  v2SearchRefetch: vi.fn(),
  v2Error: null as unknown,
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
    error: mocks.v2Error,
    isLoading: false,
    hasNextPage: mocks.v2HasNextPage,
    isFetchingNextPage: false,
    fetchNextPage: mocks.v2FetchNextPage,
    refetch: mocks.v2SearchRefetch,
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
  mocks.v2SearchRefetch.mockReset();
  mocks.v2Error = null;
  mocks.v2FetchNextPage.mockReset();
  mocks.v2HasNextPage = false;
  mocks.v2SearchData = undefined;
});

describe("SearchPage", () => {
  it("opens the shared filter controls in a mobile dialog", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Open filters" }));

    expect(screen.getByRole("dialog", { name: "Filters" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show results" })).toBeInTheDocument();
  });

  it("retries only the active V2 search after a blocking search failure", () => {
    mocks.v2Error = new Error("search unavailable");
    renderPage("/search?q=phone");

    expect(screen.getByText("Products could not be loaded")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(mocks.v2SearchRefetch).toHaveBeenCalledTimes(1);
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
    expect(mocks.v2SearchRefetch).not.toHaveBeenCalled();
  });

  it("uses the projected rating and review count for the star filter", () => {
    mocks.v2SearchData = {
      pages: [
        {
          data: {
            items: [
              {
                id: "product-sony",
                name: "Tai nghe Sony WH-1000XM5",
                description: "Headphones",
                price: 8990000,
                rating: 4,
                reviewCount: 1,
                variants: [],
              },
            ],
          },
        },
      ],
    };

    renderPage("/search?q=Sony&minRating=4");

    expect(screen.getByText("Tai nghe Sony WH-1000XM5")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });
});
