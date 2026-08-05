import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { IconButton } from "./icon-button";

export interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  labels?: {
    navigation?: string;
    previous?: string;
    next?: string;
    page?: (page: number, pageCount: number) => ReactNode;
  };
}

export function Pagination({
  page,
  pageCount,
  onPageChange,
  disabled = false,
  labels,
}: PaginationProps) {
  const safePageCount = Math.max(1, pageCount);
  const safePage = Math.min(Math.max(1, page), safePageCount);
  const atStart = safePage === 1;
  const atEnd = safePage === safePageCount;

  return (
    <nav
      aria-label={labels?.navigation ?? "Pagination"}
      className="flex min-h-[var(--target-web)] items-center justify-center gap-2"
    >
      <IconButton
        label={labels?.previous ?? "Previous page"}
        disabled={disabled || atStart}
        onClick={() => onPageChange(safePage - 1)}
      >
        <ChevronLeft />
      </IconButton>
      <span className="min-w-24 text-center text-sm text-muted-foreground" aria-live="polite">
        {labels?.page?.(safePage, safePageCount) ?? `Page ${safePage} of ${safePageCount}`}
      </span>
      <IconButton
        label={labels?.next ?? "Next page"}
        disabled={disabled || atEnd}
        onClick={() => onPageChange(safePage + 1)}
      >
        <ChevronRight />
      </IconButton>
    </nav>
  );
}
