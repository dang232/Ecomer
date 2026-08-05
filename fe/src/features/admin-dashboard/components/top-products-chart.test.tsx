import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TopProductsChart } from "./top-products-chart";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: "en-US" },
  }),
}));

describe("TopProductsChart", () => {
  it("renders an explicit empty state when there are no top products", () => {
    render(<TopProductsChart products={[]} />);

    expect(screen.getByTestId("admin-top-products-empty")).toBeVisible();
    expect(screen.queryByTestId("admin-top-products-chart")).not.toBeInTheDocument();
  });

  it("renders top-product data in a responsive bar chart", () => {
    render(
      <TopProductsChart
        products={[
          { id: "product-1", name: "Coffee maker", unitsSold: 42 },
          { id: "product-2", name: "Electric kettle", unitsSold: 18 },
        ]}
      />,
    );

    expect(screen.getByTestId("admin-top-products-chart")).toBeVisible();
    expect(screen.queryByTestId("admin-top-products-empty")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "admin.dashboard.topProducts" })).toBeVisible();
  });
});
