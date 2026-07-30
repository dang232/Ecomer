import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MobileFilterDrawer } from "./mobile-filter-drawer";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

describe("MobileFilterDrawer", () => {
  it("stages filter edits until the shopper applies them", () => {
    const onApply = vi.fn();
    render(
      <MobileFilterDrawer
        open
        onOpenChange={vi.fn()}
        onApply={onApply}
        categories={[{ id: "electronics", label: "Electronics" }]}
        facets={{ categories: [], brands: [], tags: [] }}
        values={{
          selectedCategory: "",
          selectedBrand: "",
          priceMin: "",
          priceMax: "",
          minRating: 0,
          selectedTags: [],
          sameDay: false,
          verifiedOnly: false,
          officialOnly: false,
        }}
        hasActiveFilters={false}
        priceError={null}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "Electronics" }));
    expect(onApply).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Show results" }));
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ selectedCategory: "electronics" }),
    );
  });
});
