import { ChevronLeft, ChevronRight } from "lucide-react";

import { IconButton } from "./icon-button";

export interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

export function Pagination({ page, pageCount, onPageChange, disabled = false }: PaginationProps) {
  const safePageCount = Math.max(1, pageCount);
  const safePage = Math.min(Math.max(1, page), safePageCount);
  const atStart = safePage === 1;
  const atEnd = safePage === safePageCount;

  return (
    <nav
      aria-label="Pagination"
      className="flex min-h-[var(--target-web)] items-center justify-center gap-2"
    >
      <IconButton
        label="Previous page"
        disabled={disabled || atStart}
        onClick={() => onPageChange(safePage - 1)}
      >
        <ChevronLeft />
      </IconButton>
      <span className="min-w-24 text-center text-sm text-muted-foreground" aria-live="polite">
        Page {safePage} of {safePageCount}
      </span>
      <IconButton
        label="Next page"
        disabled={disabled || atEnd}
        onClick={() => onPageChange(safePage + 1)}
      >
        <ChevronRight />
      </IconButton>
    </nav>
  );
}
