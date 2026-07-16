import { Star } from "lucide-react";
import { memo } from "react";
import { useNavigate } from "react-router";

import type { RecentlyViewedItem } from "../hooks/use-recently-viewed";
import { formatPrice } from "../lib/format";

import { ImageWithFallback } from "./image-with-fallback";

// ─── Recently Viewed Card ────────────────────────────────────────────────────────
const RecentlyViewedCard = memo(function RecentlyViewedCard({
  item,
}: {
  item: RecentlyViewedItem;
}) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(`/product/${item.productId}`)}
      className="bg-card border border-border rounded-[var(--radius-lg)] overflow-hidden cursor-pointer transition-all duration-[var(--duration-base)] hover:border-border-hover hover:shadow-lg hover:-translate-y-1 text-left w-full p-0"
    >
      {/* Image */}
      <div className="relative aspect-square bg-surface-elevated overflow-hidden flex items-center justify-center">
        <ImageWithFallback
          src={item.image}
          alt={item.name}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Body */}
      <div className="p-3">
        <h3 className="text-sm font-medium text-foreground leading-snug line-clamp-2 mb-1.5 min-h-[2.5rem]">
          {item.name}
        </h3>
        <div className="flex items-baseline gap-1.5 flex-wrap mb-1.5">
          <span className="text-[var(--text-base)] font-bold text-primary">
            {formatPrice(item.price)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <Star className="w-3 h-3 text-accent fill-accent" />
            <span className="text-foreground font-medium">{item.rating}</span>
          </div>
        </div>
      </div>
    </button>
  );
});

// ─── Recently Viewed Grid ────────────────────────────────────────────────────────
export function RecentlyViewedGrid({
  title,
  items,
}: {
  title?: string;
  items: RecentlyViewedItem[];
}) {
  if (items.length === 0) return null;

  return (
    <section>
      {title ? (
        <h2 className="text-xl font-bold text-foreground tracking-tight mb-5">{title}</h2>
      ) : null}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {items.map((item) => (
          <RecentlyViewedCard key={item.productId} item={item} />
        ))}
      </div>
    </section>
  );
}
