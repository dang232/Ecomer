import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("../hooks/auth-context", () => ({
  useAuth: () => ({ subject: "seller-123" }),
}));

vi.mock("@/features/seller-products", () => ({
  SellerProductsListRoute: ({ sellerId }: { sellerId?: string }) => <p>{sellerId}</p>,
}));

import { SellerProductsRoute } from "./seller-products-route";

describe("SellerProductsRoute", () => {
  test("passes the authenticated seller subject to the feature route", () => {
    render(<SellerProductsRoute />);

    expect(screen.getByText("seller-123")).toBeInTheDocument();
  });
});
