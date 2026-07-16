import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SearchFilters, type SearchFilterValues } from "./search-filters";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

const values: SearchFilterValues = {
  selectedCategory: "electronics",
  selectedBrand: "",
  priceMin: "2",
  priceMax: "-4",
  minRating: 0,
  freeShipping: false,
  sameDay: false,
  verifiedOnly: false,
  officialOnly: false,
};

function renderFilters(overrides: Partial<React.ComponentProps<typeof SearchFilters>> = {}) {
  const props: React.ComponentProps<typeof SearchFilters> = {
    idPrefix: "test",
    categories: [
      { id: "electronics", label: "Electronics" },
      { id: "home", label: "Home" },
    ],
    facets: {
      categories: [
        { key: "electronics", count: 12 },
        { key: "home", count: 5 },
      ],
      brands: [],
    },
    values,
    hasActiveFilters: true,
    priceError: "Maximum price cannot be negative.",
    onClear: vi.fn(),
    onCategoryChange: vi.fn(),
    onBrandChange: vi.fn(),
    onPriceMinChange: vi.fn(),
    onPriceMaxChange: vi.fn(),
    onApplyPrice: vi.fn(),
    onRatingChange: vi.fn(),
    onFreeShippingChange: vi.fn(),
    onSameDayChange: vi.fn(),
    onVerifiedChange: vi.fn(),
    onOfficialChange: vi.fn(),
    ...overrides,
  };

  render(<SearchFilters {...props} />);
  return props;
}

describe("SearchFilters", () => {
  it("renders each category once and models it as a single choice", () => {
    renderFilters();

    expect(screen.getAllByRole("radio", { name: /Electronics/ })).toHaveLength(1);
    expect(screen.getByRole("radio", { name: /Electronics/ })).toBeChecked();
  });

  it("announces an invalid price range and blocks applying it", () => {
    renderFilters();

    expect(screen.getByRole("alert")).toHaveTextContent("Maximum price cannot be negative.");
    expect(screen.getByRole("button", { name: "Apply price" })).toBeDisabled();
  });

  it("emits explicit boolean changes for seller filters", () => {
    const props = renderFilters();
    fireEvent.click(screen.getByRole("checkbox", { name: "Official stores" }));
    expect(props.onOfficialChange).toHaveBeenCalledWith(true);
  });
});
