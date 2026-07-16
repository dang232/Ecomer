import { fireEvent, render, screen } from "@testing-library/react";
import { type HTMLAttributes, type ReactNode, createElement } from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeWrapper } from "../test-utils/render-with-query-client";

const mocks = vi.hoisted(() => ({
  catalogRefetch: vi.fn(),
  searchRefetch: vi.fn(),
  searchError: null as unknown,
}));

vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) =>
      createElement("div", props, children),
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

vi.mock("../hooks/use-product-review-summaries", () => ({
  useProductReviewSummaries: () => ({ data: {} }),
}));

import { SearchPage } from "./SearchPage";

const { Wrapper } = makeWrapper();

function renderPage(entry = "/search") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Wrapper>
        <SearchPage />
      </Wrapper>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.catalogRefetch.mockReset();
  mocks.searchRefetch.mockReset();
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
});
