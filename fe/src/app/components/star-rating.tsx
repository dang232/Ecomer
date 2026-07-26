import { useId } from "react";

interface StarRatingProps {
  value: number;
  max?: number;
  size?: number;
}

/** Shared read-only rating display for catalog cards and product details. */
export function StarRating({ value, max = 5, size = 16 }: StarRatingProps) {
  const idPrefix = useId().replace(/:/g, "");
  const safeMax = Math.max(0, Math.floor(max));
  const safeValue = Number.isFinite(value) ? Math.min(safeMax, Math.max(0, value)) : 0;

  return (
    <div className="flex items-center gap-0.5" aria-label={`${safeValue} out of ${safeMax} stars`}>
      {Array.from({ length: safeMax }).map((_, index) => {
        const filled = index < Math.floor(safeValue);
        const half = !filled && index < safeValue;
        const gradientId = `${idPrefix}-half-${index}`;

        return (
          <svg key={gradientId} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="50%" stopColor="var(--rating)" />
                <stop offset="50%" stopColor="var(--border)" />
              </linearGradient>
            </defs>
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              fill={filled ? "var(--rating)" : half ? `url(#${gradientId})` : "var(--border)"}
            />
          </svg>
        );
      })}
    </div>
  );
}
