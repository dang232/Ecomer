import { fireEvent, render, screen } from "@testing-library/react";
import { type HTMLAttributes, type ReactNode, createElement } from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

type CursorFixture = {
  pages: { data: { items: Record<string, unknown>[]; facets?: unknown } }[];
};

interface SearchPageMocks {
  catalogRefetch: ReturnType<typeof vi.fn>;
  searchError: unknown;
  searchRefetch: ReturnType<typeof vi.fn>;
  v2SearchRefetch: ReturnType<typeof vi.fn>;
  v2Error: unknown;
  v2SearchIsFetching: boolean;
  v2SearchIsFetchingNextPage: boolean;
  v2SearchIsPlaceholderData: boolean;
  v2FetchNextPage: ReturnType<typeof vi.fn>;
  v2HasNextPage: boolean;
  v2SearchData: CursorFixture | undefined;
  v2CatalogData: CursorFixture | undefined;
  v2CatalogError: unknown;
  v2CatalogIsLoading: boolean;
  v2CatalogIsFetching: boolean;
  v2CatalogIsFetchingNextPage: boolean;
  v2CatalogIsPlaceholderData: boolean;
  v2CatalogRefetch: ReturnType<typeof vi.fn>;
  v2ProductsEnabled: boolean;
  v2SearchParams: Record<string, unknown> | undefined;
}

const mocks = vi.hoisted<SearchPageMocks>(() => ({
  catalogRefetch: vi.fn(),
  searchError: null,
  searchRefetch: vi.fn(),
  v2SearchRefetch: vi.fn(),
  v2Error: null,
  v2SearchIsFetching: false,
  v2SearchIsFetchingNextPage: false,
  v2SearchIsPlaceholderData: false,
  v2FetchNextPage: vi.fn(),
  v2HasNextPage: false,
  v2SearchData: undefined,
  v2CatalogData: undefined,
  v2CatalogError: null,
  v2CatalogIsLoading: false,
  v2CatalogIsFetching: false,
  v2CatalogIsFetchingNextPage: false,
  v2CatalogIsPlaceholderData: false,
  v2CatalogRefetch: vi.fn(),
  v2ProductsEnabled: false,
  v2SearchParams: undefined,
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

vi.mock("../hooks/use-vnshop", () => ({
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
  useSearchV2: (params: Record<string, unknown>) => {
    mocks.v2SearchParams = params;
    return {
      data: mocks.v2SearchData,
      error: mocks.v2Error,
      isLoading: false,
      isFetching: mocks.v2SearchIsFetching,
      isFetchingNextPage: mocks.v2SearchIsFetchingNextPage,
      isPlaceholderData: mocks.v2SearchIsPlaceholderData,
      hasNextPage: mocks.v2HasNextPage,
      fetchNextPage: mocks.v2FetchNextPage,
      refetch: mocks.v2SearchRefetch,
    };
  },
}));

vi.mock("../hooks/use-products-v2", () => ({
  useProductsV2: (_params: unknown, enabled: boolean) => {
    mocks.v2ProductsEnabled = enabled;
    return {
      data: mocks.v2CatalogData,
      error: mocks.v2CatalogError,
      isLoading: mocks.v2CatalogIsLoading,
      isFetching: mocks.v2CatalogIsFetching,
      isFetchingNextPage: mocks.v2CatalogIsFetchingNextPage,
      isPlaceholderData: mocks.v2CatalogIsPlaceholderData,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      refetch: mocks.v2CatalogRefetch,
    };
  },
}));

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
  mocks.searchError = null;
  mocks.searchRefetch.mockReset();
  mocks.v2SearchRefetch.mockReset();
  mocks.v2Error = null;
  mocks.v2SearchIsFetching = false;
  mocks.v2SearchIsFetchingNextPage = false;
  mocks.v2SearchIsPlaceholderData = false;
  mocks.v2FetchNextPage.mockReset();
  mocks.v2HasNextPage = false;
  mocks.v2SearchData = undefined;
  mocks.v2CatalogData = undefined;
  mocks.v2CatalogError = null;
  mocks.v2CatalogIsLoading = false;
  mocks.v2CatalogIsFetching = false;
  mocks.v2CatalogIsFetchingNextPage = false;
  mocks.v2CatalogIsPlaceholderData = false;
  mocks.v2CatalogRefetch.mockReset();
  mocks.v2ProductsEnabled = false;
  mocks.v2SearchParams = undefined;
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

  it("renders every loaded catalog cursor page without slicing back to 20", () => {
    mocks.v2CatalogData = {
      pages: [
        {
          data: {
            items: Array.from({ length: 20 }, (_, index) => ({
              id: `catalog-${index}`,
              name: `Catalog product ${index}`,
              price: 100000,
              variants: [],
            })),
          },
        },
        {
          data: {
            items: [
              {
                id: "catalog-20",
                name: "Catalog product 20",
                price: 100000,
                variants: [],
              },
            ],
          },
        },
      ],
    };

    renderPage("/search");

    expect(screen.getAllByTestId("product-card")).toHaveLength(21);
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
    expect(mocks.v2SearchParams).toMatchObject({ minRating: 4 });
  });

  it("sends repeated seller tags to cursor search instead of filtering the loaded page", () => {
    renderPage("/search?tag=wireless&tag=bluetooth");

    expect(mocks.v2SearchParams).toMatchObject({ tags: ["bluetooth", "wireless"] });
  });

  it("shows loading while a changed search key fetches behind retained data", () => {
    mocks.v2SearchData = {
      pages: [
        {
          data: {
            items: [
              {
                id: "previous-product",
                name: "Previous category product",
                price: 100000,
                variants: [],
              },
            ],
          },
        },
      ],
    };
    mocks.v2SearchIsFetching = true;
    mocks.v2SearchIsPlaceholderData = true;

    renderPage("/search?q=fashion");

    expect(screen.getByText(/Loading products/)).toBeInTheDocument();
    expect(screen.queryByText("Previous category product")).not.toBeInTheDocument();
  });

  it("falls back to catalog products when a category search projection is empty", () => {
    mocks.v2SearchData = { pages: [{ data: { items: [] } }] };
    mocks.v2CatalogData = {
      pages: [
        {
          data: {
            items: [
              {
                id: "fashion-1",
                name: "Fashion jacket",
                categoryId: "fashion",
                price: 450000,
                variants: [],
              },
            ],
          },
        },
      ],
    };

    renderPage("/search?q=fashion");

    expect(mocks.v2ProductsEnabled).toBe(true);
    expect(screen.getByText("Fashion jacket")).toBeInTheDocument();
  });

  it("hydrates missing search images from the catalog projection", () => {
    mocks.v2SearchData = {
      pages: [
        {
          data: {
            items: [
              {
                id: "missing-image",
                name: "Headphones",
                categoryId: "electronics",
                imageUrl: null,
                price: 199000,
                variants: [],
              },
            ],
          },
        },
      ],
    };
    mocks.v2CatalogData = {
      pages: [
        {
          data: {
            items: [
              {
                id: "missing-image",
                name: "Headphones",
                categoryId: "electronics",
                imageUrl: "https://catalog/headphones.jpg",
                price: 199000,
                variants: [],
              },
            ],
          },
        },
      ],
    };

    renderPage("/search?q=headphones");

    expect(mocks.v2ProductsEnabled).toBe(true);
    expect(screen.getByRole("img", { name: "Headphones" })).toHaveAttribute(
      "src",
      "https://catalog/headphones.jpg",
    );
  });

  it("does not show placeholder catalog data while the fallback key is fetching", () => {
    mocks.v2SearchData = { pages: [{ data: { items: [] } }] };
    mocks.v2CatalogData = {
      pages: [
        {
          data: {
            items: [
              {
                id: "previous-catalog-product",
                name: "Previous catalog product",
                categoryId: "electronics",
                price: 199000,
                variants: [],
              },
            ],
          },
        },
      ],
    };
    mocks.v2CatalogIsFetching = true;
    mocks.v2CatalogIsPlaceholderData = true;

    renderPage("/search?cat=fashion");

    expect(screen.getByText(/Loading products/)).toBeInTheDocument();
    expect(screen.queryByText("Previous catalog product")).not.toBeInTheDocument();
  });
});
