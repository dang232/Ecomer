import type { ReactNode } from "react";

import { cn } from "../lib/cn";

export interface DataTableColumn<TRow> {
  id: string;
  header: ReactNode;
  cell: (row: TRow) => ReactNode;
  priority?: "primary" | "secondary" | "tertiary";
  align?: "start" | "center" | "end";
}

export interface DataTableProps<TRow> {
  rows: readonly TRow[];
  columns: readonly DataTableColumn<TRow>[];
  rowKey: (row: TRow) => string;
  selectedId?: string;
  onRowOpen?: (row: TRow) => void;
  empty: ReactNode;
  caption: string;
}

const priorityClasses = {
  primary: "",
  secondary: "max-md:hidden",
  tertiary: "max-lg:hidden",
};

const alignClasses = {
  start: "text-left",
  center: "text-center",
  end: "text-right",
};

export function DataTable<TRow>({
  rows,
  columns,
  rowKey,
  selectedId,
  onRowOpen,
  empty,
  caption,
}: DataTableProps<TRow>) {
  if (rows.length === 0) return <div role="status">{empty}</div>;

  return (
    <div className="overflow-x-auto border border-border">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted text-xs font-semibold uppercase text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={cn(
                  "px-4 py-3",
                  priorityClasses[column.priority ?? "primary"],
                  alignClasses[column.align ?? "start"],
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => {
            const id = rowKey(row);
            return (
              <tr key={id} className={cn(selectedId === id && "bg-primary-light")}>
                {columns.map((column, index) => (
                  <td
                    key={column.id}
                    className={cn(
                      "px-4 py-3 align-middle text-foreground",
                      priorityClasses[column.priority ?? "primary"],
                      alignClasses[column.align ?? "start"],
                    )}
                  >
                    {column.cell(row)}
                    {index === 0 && onRowOpen ? (
                      <button
                        type="button"
                        onClick={() => onRowOpen(row)}
                        className="sr-only focus:not-sr-only focus:ml-2 focus:rounded-[var(--radius-control)] focus:bg-card focus:px-2 focus:py-1 focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        Open {id}
                      </button>
                    ) : null}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
