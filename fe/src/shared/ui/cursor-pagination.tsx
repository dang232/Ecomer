import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

import { IconButton } from "./icon-button";

export interface CursorPaginationProps {
  readonly itemCount: number;
  readonly pageIndex: number;
  readonly pageSize: number;
  readonly hasPrevious: boolean;
  readonly hasMore: boolean;
  readonly isFetching?: boolean;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly onRefresh: () => void;
  readonly onPageSizeChange: (pageSize: number) => void;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

export function CursorPagination({
  itemCount,
  pageIndex,
  pageSize,
  hasPrevious,
  hasMore,
  isFetching = false,
  onPrevious,
  onNext,
  onRefresh,
  onPageSizeChange,
}: CursorPaginationProps) {
  const start = itemCount === 0 ? 0 : pageIndex * pageSize + 1;
  const end = pageIndex * pageSize + itemCount;
  const disabled = isFetching;

  return (
    <nav
      aria-label="Cursor pagination"
      className="flex min-h-[var(--target-web)] flex-wrap items-center justify-between gap-3 border-t border-border py-3"
    >
      <span className="text-sm text-muted-foreground" aria-live="polite">
        {itemCount === 0 ? "No records" : `Showing ${start}–${end}`}
      </span>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Rows</span>
          <select
            aria-label="Rows per page"
            value={pageSize}
            disabled={disabled}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="min-h-[var(--target-web)] rounded-[var(--radius-control)] border border-border bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <IconButton label="Refresh records" disabled={disabled} onClick={onRefresh}>
          <RefreshCw className={isFetching ? "animate-spin" : undefined} />
        </IconButton>
        <IconButton label="Previous page" disabled={disabled || !hasPrevious} onClick={onPrevious}>
          <ChevronLeft />
        </IconButton>
        <span className="min-w-20 text-center text-sm text-muted-foreground">
          Page {pageIndex + 1}
        </span>
        <IconButton label="Next page" disabled={disabled || !hasMore} onClick={onNext}>
          <ChevronRight />
        </IconButton>
      </div>
    </nav>
  );
}
