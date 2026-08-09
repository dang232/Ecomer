import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CursorPagination } from "./cursor-pagination";

function renderPagination(overrides: Partial<Parameters<typeof CursorPagination>[0]> = {}) {
  const props = {
    itemCount: 25,
    pageIndex: 1,
    pageSize: 25,
    hasPrevious: true,
    hasMore: true,
    onPrevious: vi.fn(),
    onNext: vi.fn(),
    onRefresh: vi.fn(),
    onPageSizeChange: vi.fn(),
    ...overrides,
  };
  return { ...render(<CursorPagination {...props} />), props };
}

describe("CursorPagination", () => {
  it("announces the current range and page", () => {
    renderPagination();

    expect(screen.getByText("Showing 26–50")).toBeVisible();
    expect(screen.getByText("Page 2")).toBeVisible();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled();
  });

  it("routes previous, next, refresh, and page-size actions", () => {
    const { props } = renderPagination();

    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh records" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Rows per page" }), {
      target: { value: "100" },
    });

    expect(props.onPrevious).toHaveBeenCalledOnce();
    expect(props.onNext).toHaveBeenCalledOnce();
    expect(props.onRefresh).toHaveBeenCalledOnce();
    expect(props.onPageSizeChange).toHaveBeenCalledWith(100);
  });

  it("disables navigation while fetching and when a boundary is reached", () => {
    renderPagination({ hasPrevious: false, hasMore: false, isFetching: true });

    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Refresh records" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Rows per page" })).toBeDisabled();
  });
});
