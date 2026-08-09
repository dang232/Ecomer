import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useAdminCursorPagination } from "./use-admin-cursor-pagination";

describe("useAdminCursorPagination", () => {
  it("tracks cursor history so next and previous return to the same pages", () => {
    const { result } = renderHook(() => useAdminCursorPagination({ scopeKey: "all" }));

    act(() => result.current.advance("page-2"));
    expect(result.current).toMatchObject({
      cursor: "page-2",
      pageIndex: 1,
      hasPrevious: true,
    });

    act(() => result.current.advance("page-3"));
    expect(result.current.pageIndex).toBe(2);

    act(() => result.current.goBack());
    expect(result.current).toMatchObject({ cursor: "page-2", pageIndex: 1 });

    act(() => result.current.goBack());
    expect(result.current).toMatchObject({ cursor: undefined, pageIndex: 0, hasPrevious: false });
  });

  it("resets cursor state when the filter scope or page size changes", () => {
    const { result, rerender } = renderHook(
      ({ scopeKey }) => useAdminCursorPagination({ scopeKey }),
      { initialProps: { scopeKey: "all" } },
    );

    act(() => result.current.advance("page-2"));
    rerender({ scopeKey: "pending" });
    expect(result.current).toMatchObject({ cursor: undefined, pageIndex: 0, hasPrevious: false });

    act(() => result.current.setPageSize(100));
    expect(result.current).toMatchObject({ cursor: undefined, pageIndex: 0, pageSize: 100 });
  });

  it("does not advance when the server reports no next cursor", () => {
    const { result } = renderHook(() => useAdminCursorPagination({ scopeKey: "all" }));

    act(() => result.current.advance(null));
    expect(result.current.pageIndex).toBe(0);
    expect(result.current.cursor).toBeUndefined();
  });
});
