import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AsyncState } from "./async-state";
import { resolveAsyncStatus } from "./async-state-model";

describe("resolveAsyncStatus", () => {
  it("keeps stale data visible while it refreshes", () => {
    expect(
      resolveAsyncStatus({ isLoading: true, hasError: false, isEmpty: false, hasData: true }),
    ).toBe("ready");
  });

  it("does not report a failed request as empty", () => {
    expect(
      resolveAsyncStatus({ isLoading: false, hasError: true, isEmpty: true, hasData: false }),
    ).toBe("error");
  });
});

describe("AsyncState", () => {
  const renderState = (
    status: React.ComponentProps<typeof AsyncState>["status"],
    onRetry = vi.fn(),
  ) =>
    render(
      <AsyncState
        status={status}
        loading={<span>Loading products</span>}
        error={<span>Products could not be loaded</span>}
        empty={<span>No products yet</span>}
        retry={{ label: "Try again", onClick: onRetry }}
      >
        <span>Product results</span>
      </AsyncState>,
    );

  it("announces the initial loading state", () => {
    renderState("loading");

    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Loading products")).toBeInTheDocument();
  });

  it("renders an alert and a working retry action for errors", () => {
    const onRetry = vi.fn();
    renderState("error", onRetry);

    expect(screen.getByRole("alert")).toHaveTextContent("Products could not be loaded");
    expect(screen.queryByText("No products yet")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("renders empty and ready content as distinct states", () => {
    const { rerender } = renderState("empty");
    expect(screen.getByRole("status")).toHaveTextContent("No products yet");

    rerender(
      <AsyncState
        status="ready"
        loading={<span>Loading products</span>}
        error={<span>Error</span>}
        empty={<span>Empty</span>}
      >
        <span>Product results</span>
      </AsyncState>,
    );
    expect(screen.getByText("Product results")).toBeInTheDocument();
  });
});
