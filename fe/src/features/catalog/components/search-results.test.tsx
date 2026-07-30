import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { SearchResults } from "./search-results";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

describe("SearchResults", () => {
  it("uses the canonical product tile for partial fallback results", () => {
    render(
      <MemoryRouter>
        <SearchResults
          view={{
            status: "partial",
            source: "fallback",
            query: "camera",
            resultCount: 1,
            products: [
              {
                id: "camera-1",
                name: "Camera Pro",
                imageUrl: "",
                priceVnd: 1_000_000,
                stockState: "in-stock",
              },
            ],
          }}
          onRetry={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("product-tile")).toHaveTextContent("Camera Pro");
  });

  it("renders an explicit empty state", () => {
    render(
      <MemoryRouter>
        <SearchResults
          view={{
            status: "empty",
            source: "primary",
            query: "camera",
            resultCount: 0,
            products: [],
          }}
          onRetry={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "No products found" })).toBeInTheDocument();
  });
});
