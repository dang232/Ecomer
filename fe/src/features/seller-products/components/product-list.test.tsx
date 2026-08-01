/**
 * Integration test for ProductList.
 *
 * Note: The seller product catalog list endpoint (`useProducts` backed by
 * `/products`) returns ACTIVE catalog products only.
 * Deep-linked editing is supported for an ACTIVE row or a session-recovered
 * draft, NOT for an arbitrary unpublished product ID.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import type { ProductListRow } from "../model/product-list-view";

import { ProductList } from "./product-list";
import type { SellerProductsRouteState } from "./product-list";

const makeRow = (overrides: Partial<ProductListRow> = {}): ProductListRow => ({
  id: "p-1",
  name: "Test Product",
  image: null,
  images: [],
  publication: "ACTIVE",
  priceRange: "₫990,000",
  priceMin: 990000,
  priceMax: 990000,
  stockTotal: 10,
  sold: 5,
  ...overrides,
});

const renderList = (
  rows: ProductListRow[],
  routeState: SellerProductsRouteState,
  onRouteChange: (s: SellerProductsRouteState) => void,
) =>
  render(
    <MemoryRouter>
      <ProductList rows={rows} routeState={routeState} onRouteChange={onRouteChange} />
    </MemoryRouter>,
  );

describe("ProductList", () => {
  it("renders the table with product rows", () => {
    const rows = [makeRow(), makeRow({ id: "p-2", name: "Second Product" })];
    renderList(rows, { q: "", page: 1, mode: null, selected: null }, vi.fn());

    expect(screen.getByText("Test Product")).toBeInTheDocument();
    expect(screen.getByText("Second Product")).toBeInTheDocument();
  });

  it("shows stock and sold columns", () => {
    const rows = [makeRow({ stockTotal: 42, sold: 7 })];
    renderList(rows, { q: "", page: 1, mode: null, selected: null }, vi.fn());

    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("shows a hyphen when sold is not present", () => {
    const rows = [makeRow({ sold: null })];
    renderList(rows, { q: "", page: 1, mode: null, selected: null }, vi.fn());

    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("shows price range when min != max", () => {
    const rows = [
      makeRow({
        priceRange: "₫100,000 – ₫200,000",
        priceMin: 100000,
        priceMax: 200000,
      }),
    ];
    renderList(rows, { q: "", page: 1, mode: null, selected: null }, vi.fn());

    expect(screen.getByText("₫100,000 – ₫200,000")).toBeInTheDocument();
  });

  it("triggers edit navigation when edit button is clicked", () => {
    const onRouteChange = vi.fn();
    const rows = [makeRow({ id: "p-edit" })];
    renderList(rows, { q: "", page: 1, mode: null, selected: null }, onRouteChange);

    const editBtn = screen.getByRole("button", { name: /edit/i });
    fireEvent.click(editBtn);

    expect(onRouteChange).toHaveBeenCalledWith(
      expect.objectContaining({ selected: "p-edit", mode: "edit" }),
    );
  });

  it("triggers create mode when add button is clicked", () => {
    const onRouteChange = vi.fn();
    renderList([], { q: "", page: 1, mode: null, selected: null }, onRouteChange);

    const addBtn = screen.getByRole("button", { name: /seller\.products\.addNew/i });
    fireEvent.click(addBtn);

    expect(onRouteChange).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "create", selected: null }),
    );
  });

  it("renders empty state when no rows", () => {
    renderList([], { q: "", page: 1, mode: null, selected: null }, vi.fn());
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
