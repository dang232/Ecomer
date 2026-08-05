import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSearchParams } from "react-router";

interface NotificationPaginationProps {
  totalPages: number;
  currentPage: number;
}

export function NotificationPagination({ totalPages, currentPage }: NotificationPaginationProps) {
  const [, setParams] = useSearchParams();

  if (totalPages <= 1) return null;

  const goTo = (page: number) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("page", String(page));
      return next;
    });
  };

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-3 py-4">
      <button
        onClick={() => goTo(currentPage - 1)}
        disabled={currentPage <= 0}
        aria-label="Previous page"
        className="rounded-lg p-2 hover:bg-muted disabled:opacity-60 transition-colors"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="text-sm text-muted-foreground" aria-current="page">
        Trang {currentPage + 1} / {totalPages}
      </span>
      <button
        onClick={() => goTo(currentPage + 1)}
        disabled={currentPage >= totalPages - 1}
        aria-label="Next page"
        className="rounded-lg p-2 hover:bg-muted disabled:opacity-60 transition-colors"
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}
