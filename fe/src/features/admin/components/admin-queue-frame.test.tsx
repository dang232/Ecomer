import type { ColumnDef } from "@tanstack/react-table";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ADMIN_QUEUE_CAPABILITIES } from "../model/queue-capabilities";

import { AdminQueueFrame } from "./admin-queue-frame";
import type { AdminQueueFrameProps } from "./admin-queue-frame";

function renderFrame(props?: Partial<AdminQueueFrameProps<{ id: string }>>) {
  const columns: ColumnDef<{ id: string }>[] = [
    { accessorKey: "id", header: "ID" },
  ];
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
      columns={columns}
      pagination={{ page: 0, totalPages: 1, totalElements: 0 }}
      onPageChange={() => undefined}
      drawerTitle="Detail"
      {...props}
    />,
  );
}

describe("AdminQueueFrame", () => {
  it("omits unsupported sort and bulk controls", () => {
    renderFrame();
    expect(screen.queryByRole("combobox", { name: /sort/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /select all/i })).not.toBeInTheDocument();
    expect(screen.getByRole("searchbox")).toBeVisible();
  });
});
