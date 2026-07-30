import { formatPrice } from "@/shared/lib";

export interface PriceProps {
  priceVnd: number;
  originalPriceVnd?: number;
  className?: string;
}

function safePrice(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function Price({ priceVnd, originalPriceVnd, className }: PriceProps) {
  const price = safePrice(priceVnd);
  const original = originalPriceVnd === undefined ? undefined : safePrice(originalPriceVnd);
  const hasDiscount = original !== undefined && original > price;
  const discount = hasDiscount ? Math.round(((original - price) / original) * 100) : null;

  return (
    <div
      className={`flex min-h-10 flex-wrap items-baseline gap-x-2 gap-y-1 px-3 py-2 ${className ?? ""}`}
    >
      <span className="text-base font-bold text-primary">{formatPrice(price)}</span>
      {hasDiscount ? (
        <s className="text-xs text-muted-foreground">{formatPrice(original)}</s>
      ) : null}
      {discount ? (
        <span className="rounded-[var(--radius-sm)] bg-error-light px-1.5 py-0.5 text-xs font-semibold text-error">
          -{discount}%
        </span>
      ) : null}
    </div>
  );
}
