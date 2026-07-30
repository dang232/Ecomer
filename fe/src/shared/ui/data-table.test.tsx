import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DataTable, type DataTableColumn } from "./data-table";

interface OrderRow {
  id: string;
  customer: string;
  status: string;
}

const columns: DataTableColumn<OrderRow>[] = [
  { id: "customer", header: "Customer", cell: (row) => row.customer },
  { id: "status", header: "Status", cell: (row) => row.status, priority: "secondary" },
  { id: "id", header: "Reference", cell: (row) => row.id, priority: "tertiary" },
];

describe("DataTable", () => {
  it("keeps primary cells and an accessible row action at every breakpoint", () => {
    const onRowOpen = vi.fn();
    render(
      <DataTable
        caption="Recent seller orders"
        rows={[{ id: "order-1", customer: "Mai", status: "Paid" }]}
        columns={columns}
        rowKey={(row) => row.id}
        selectedId="order-1"
        onRowOpen={onRowOpen}
        empty="No orders"
      />,
    );

    expect(screen.getByRole("table", { name: "Recent seller orders" })).toBeInTheDocument();
    expect(screen.getByText("Mai")).toBeInTheDocument();
    expect(screen.getByText("Paid").closest("td")?.className).toContain("max-md:hidden");
    expect(screen.getByText("order-1").closest("td")?.className).toContain("max-lg:hidden");
    fireEvent.click(screen.getByRole("button", { name: "Open order-1" }));
    expect(onRowOpen).toHaveBeenCalledWith({ id: "order-1", customer: "Mai", status: "Paid" });
  });

  it("uses the provided empty state when no rows exist", () => {
    render(
      <DataTable
        caption="Recent seller orders"
        rows={[]}
        columns={columns}
        rowKey={(row) => row.id}
        empty="No orders"
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("No orders");
  });
});
