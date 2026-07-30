import { Star } from "lucide-react";

export interface RatingProps {
  value?: number;
  soldCount?: number;
}

function formatSoldCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m sold`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k sold`;
  return `${value} sold`;
}

export function Rating({ value, soldCount }: RatingProps) {
  const hasRating = value !== undefined && Number.isFinite(value);
  const rating = hasRating ? Math.min(5, Math.max(0, value)) : null;
  const hasSoldCount = soldCount !== undefined && Number.isFinite(soldCount) && soldCount >= 0;

  if (rating === null && !hasSoldCount) return null;

  return (
    <div className="flex min-h-5 items-center gap-1.5 text-xs text-muted-foreground">
      {rating !== null ? (
        <span
          className="inline-flex items-center gap-1 font-medium text-foreground"
          aria-label={`${rating} out of 5 stars`}
        >
          <Star
            className="h-3.5 w-3.5 fill-[var(--color-rating)] text-[var(--color-rating)]"
            aria-hidden="true"
          />
          {rating.toFixed(1)}
        </span>
      ) : null}
      {rating !== null && hasSoldCount ? <span aria-hidden="true">·</span> : null}
      {hasSoldCount ? <span>{formatSoldCount(Math.floor(soldCount))}</span> : null}
    </div>
  );
}
