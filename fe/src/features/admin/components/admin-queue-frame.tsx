import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { CursorPagination, type CursorPaginationProps } from "@/shared/ui/cursor-pagination";
import { DataTable, type DataTableColumn } from "@/shared/ui/data-table";
import { EmptyState } from "@/shared/ui/empty-state";
import { PageContainer } from "@/shared/ui/page-container";
import { PageHeader } from "@/shared/ui/page-header";
import { Pagination } from "@/shared/ui/pagination";
import { TableToolbar } from "@/shared/ui/table-toolbar";

import type { QueueCapabilities } from "../model/queue-capabilities";

import { SearchField, SortMenu, StatusFilter } from "./admin-queue-toolbar";
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
  cursorPagination?: CursorPaginationProps;
  cursorError?: boolean;
  onResetCursor?: () => void;
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
  cursorPagination,
  cursorError = false,
  onResetCursor,
  drawerTitle,
  drawerDescription,
  children,
}: AdminQueueFrameProps<T>) {
  const { t } = useTranslation();

  const handleDrawerClose = () => onSelect(null);
  const paginationFooter = cursorPagination ? (
    <CursorPagination {...cursorPagination} />
  ) : capabilities.pagination === "server" && pagination ? (
    <Pagination
      page={pagination.page}
      pageCount={pagination.totalPages}
      onPageChange={onPageChange}
    />
  ) : null;

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
          <p>{cursorError ? "This cursor expired or is invalid." : t("admin.queue.loadErr")}</p>
          {cursorError && onResetCursor ? (
            <button
              type="button"
              onClick={onResetCursor}
              className="mt-3 min-h-[var(--target-web)] rounded-[var(--radius-control)] border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Reset cursor
            </button>
          ) : null}
        </div>
      ) : rows.length === 0 ? (
        <>
          <EmptyState title={t("admin.queue.empty")} description="" icon={null} />
          {paginationFooter}
        </>
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
          {paginationFooter}
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
