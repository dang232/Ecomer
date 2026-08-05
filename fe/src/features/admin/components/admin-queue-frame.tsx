import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { DataTable, type DataTableColumn } from "@/shared/ui/data-table";
import { EmptyState } from "@/shared/ui/empty-state";
import { PageContainer } from "@/shared/ui/page-container";
import { PageHeader } from "@/shared/ui/page-header";
import { Pagination } from "@/shared/ui/pagination";
import { TableToolbar } from "@/shared/ui/table-toolbar";

import type { QueueCapabilities } from "../model/queue-capabilities";

import { AdminRecordDrawer } from "./admin-record-drawer";

export interface PaginationState {
  page: number;
  totalPages: number;
  totalElements: number;
}

export interface QueueState {
  q: string;
  status: string;
}

export interface AdminQueueFrameProps<T> {
  title: string;
  description?: string;
  capabilities: QueueCapabilities;
  // toolbar state
  q: string;
  status: string;
  sort: string;
  onSearch: (q: string) => void;
  onStatusChange: (status: string) => void;
  onSortChange?: (sort: string) => void;
  // selection
  selectedId: string | null | undefined;
  onSelect: (id: string | null) => void;
  // table
  rows: readonly T[];
  columns: readonly DataTableColumn<T>[];
  isLoading?: boolean;
  isError?: boolean;
  // pagination — only rendered when capabilities.pagination === "server"
  pagination?: PaginationState;
  onPageChange: (page: number) => void;
  // drawer content
  drawerTitle: string;
  drawerDescription?: string;
  children: ReactNode;
}

function rowId(row: unknown): string {
  if (typeof row !== "object" || row === null || !("id" in row)) return "";
  const id = row.id;
  return typeof id === "string" || typeof id === "number" ? String(id) : "";
}

/**
 * Shared queue frame. Toolbar controls are derived strictly from capabilities:
 * - search field: if capabilities.search === true
 * - status filter: if capabilities.status === true
 * - sort menu: if capabilities.sort.length > 0
 * No bulk checkboxes. No "select all" when selection === "single".
 */
export function AdminQueueFrame<T>({
  title,
  description,
  capabilities,
  q,
  status,
  sort,
  onSearch,
  onStatusChange,
  onSortChange,
  selectedId,
  onSelect,
  rows,
  columns,
  isLoading,
  isError,
  pagination,
  onPageChange,
  drawerTitle,
  drawerDescription,
  children,
}: AdminQueueFrameProps<T>) {
  const { t } = useTranslation();

  const handleDrawerClose = () => onSelect(null);

  return (
    <PageContainer density="compact">
      <PageHeader title={title} description={description} />

      <TableToolbar ariaLabel={title}>
        <div className="flex flex-wrap items-center gap-2">
          {capabilities.search ? (
            <SearchField
              value={q}
              onSubmit={onSearch}
              placeholder={t("admin.queue.searchPlaceholder")}
            />
          ) : null}
          {capabilities.status ? <StatusFilter value={status} onChange={onStatusChange} /> : null}
          {capabilities.sort.length > 0 && onSortChange ? (
            <SortMenu options={capabilities.sort} value={sort} onChange={onSortChange} />
          ) : null}
        </div>
      </TableToolbar>

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
          {t("admin.queue.loading")}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-border bg-card px-5 py-8 text-center text-sm text-red-600 dark:text-red-400">
          {t("admin.queue.loadErr")}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title={t("admin.queue.empty")} description="" icon={null} />
      ) : (
        <>
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={rowId}
            selectedId={selectedId ?? undefined}
            onRowOpen={(row) => onSelect(rowId(row))}
            caption={title}
            empty={null}
          />
          {capabilities.pagination === "server" && pagination ? (
            <Pagination
              page={pagination.page}
              pageCount={pagination.totalPages}
              onPageChange={onPageChange}
            />
          ) : null}
        </>
      )}

      <AdminRecordDrawer
        selectedId={selectedId}
        onClose={handleDrawerClose}
        title={drawerTitle}
        description={drawerDescription}
      >
        {selectedId != null ? children : null}
      </AdminRecordDrawer>
    </PageContainer>
  );
}

// ─── Internal toolbar sub-components ────────────────────────────────────────────

interface SearchFieldProps {
  value: string;
  onSubmit: (q: string) => void;
  placeholder?: string;
}

function SearchField({ value, onSubmit, placeholder }: SearchFieldProps) {
  return (
    <form
      className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit((e.currentTarget.elements.namedItem("q") as HTMLInputElement)?.value ?? "");
      }}
    >
      <input
        type="search"
        aria-label={placeholder ?? "Search"}
        name="q"
        defaultValue={value}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      <button
        type="submit"
        aria-label={placeholder ?? "Search"}
        className="text-muted-foreground hover:text-foreground"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </button>
    </form>
  );
}

interface StatusFilterProps {
  value: string;
  onChange: (status: string) => void;
}

function StatusFilter({ value, onChange }: StatusFilterProps) {
  return (
    <select
      aria-label="Filter by status"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
    >
      <option value="">All</option>
      <option value="PENDING_ACCEPTANCE">Pending</option>
      <option value="ACCEPTED">Accepted</option>
      <option value="PACKED">Packed</option>
      <option value="SHIPPED">Shipped</option>
      <option value="CANCELLED">Cancelled</option>
    </select>
  );
}

interface SortMenuProps {
  options: readonly string[];
  value: string;
  onChange: (sort: string) => void;
}

function SortMenu({ options, value, onChange }: SortMenuProps) {
  return (
    <select
      aria-label="Sort"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}
