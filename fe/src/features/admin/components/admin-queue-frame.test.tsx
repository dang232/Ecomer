import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ADMIN_QUEUE_CAPABILITIES } from "../model/queue-capabilities";

import { AdminQueueFrame } from "./admin-queue-frame";
import type { AdminQueueFrameProps } from "./admin-queue-frame";

function renderFrame(props?: Partial<AdminQueueFrameProps<{ id: string }>>) {
  const { children = null, ...rest } = props ?? {};
  return render(
    <AdminQueueFrame
      title="Test Queue"
      capabilities={ADMIN_QUEUE_CAPABILITIES.orders}
      q=""
      status=""
      sort=""
      onSearch={() => undefined}
      onStatusChange={() => undefined}
      onSortChange={() => undefined}
      selectedId={null}
      onSelect={() => undefined}
      rows={[]}
      columns={[]}
      pagination={{ page: 0, totalPages: 1, totalElements: 0 }}
      onPageChange={() => undefined}
      drawerTitle="Detail"
      drawerDescription="Test"
      {...rest}
    >
      {children}
    </AdminQueueFrame>,
  );
}

describe("AdminQueueFrame", () => {
  it("omits unsupported sort and bulk controls", () => {
    renderFrame();
    expect(screen.queryByRole("combobox", { name: /sort/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /select all/i })).not.toBeInTheDocument();
    expect(screen.getByRole("searchbox")).toBeVisible();
    expect(screen.getByRole("button", { name: /search/i })).toBeVisible();
  });

  it("does not open an empty drawer when selection is missing", () => {
    renderFrame({ selectedId: undefined });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps cursor controls visible for an empty page", () => {
    renderFrame({
      cursorPagination: {
        itemCount: 0,
        pageIndex: 1,
        pageSize: 50,
        hasPrevious: true,
        hasMore: false,
        onPrevious: () => undefined,
        onNext: () => undefined,
        onRefresh: () => undefined,
        onPageSizeChange: () => undefined,
      },
    });

    expect(screen.getByRole("navigation", { name: "Cursor pagination" })).toBeVisible();
    expect(screen.getByText("No records")).toBeVisible();
  });

  it("does not label ordinary load errors as expired cursors", () => {
    renderFrame({ isError: true, cursorError: false });

    expect(screen.getByText("admin.queue.loadErr")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Reset cursor" })).not.toBeInTheDocument();
  });
});
