import { Heart, Star } from "lucide-react";
import { motion } from "motion/react";
import { memo, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { formatPrice } from "../lib/format";
import type { Product } from "../types/ui";

import { ImageWithFallback } from "./image-with-fallback";
import { useVNShop } from "./vnshop-context";

interface ProductCardProps {
  product: Product;
  index?: number;
  onNavigate?: () => void;
}

function formatSoldCount(sold: number): string {
  return sold >= 1000 ? `${(sold / 1000).toFixed(1)}k` : `${sold}`;
}

export const ProductCard = memo(function ProductCard({
  product,
  index = 0,
  onNavigate,
}: ProductCardProps) {
  const { t } = useTranslation();
  const { toggleWishlist, isWishlisted } = useVNShop();
  const loved = isWishlisted(product.id);

  const handleWishlistClick = (event: MouseEvent<HTMLButtonElement>) => {
    // Keep this control outside the product links so it never triggers navigation.
    event.preventDefault();
    event.stopPropagation();
    toggleWishlist(product.id);
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.4), duration: 0.3 }}
      className="group overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card transition-all duration-[var(--duration-base)] hover:-translate-y-1 hover:border-border-hover hover:shadow-lg"
      data-testid="product-card"
    >
      <div className="relative aspect-square overflow-hidden bg-surface-elevated">
        <Link
          to={`/product/${product.id}`}
          onClick={onNavigate}
          aria-label={t("search.viewDetailsAria", { name: product.name })}
          className="block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <ImageWithFallback
            src={product.image}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-[var(--duration-base)] group-hover:scale-105"
          />
          {product.discount ? (
            <span className="absolute left-2 top-2 rounded-[var(--radius-sm)] bg-error px-2 py-0.5 text-[11px] font-semibold text-white">
              -{product.discount}%
            </span>
          ) : product.badge === "new" ? (
            <span className="absolute left-2 top-2 rounded-[var(--radius-sm)] bg-primary px-2 py-0.5 text-[11px] font-semibold text-white">
              {t("product.new")}
            </span>
          ) : null}
        </Link>

        <button
          type="button"
          aria-label={
            loved
              ? t("productCard.removeFromWishlist", { name: product.name })
              : t("productCard.addToWishlist", { name: product.name })
          }
          aria-pressed={loved}
          className={`absolute right-2 top-2 flex min-h-[var(--target-web)] min-w-[var(--target-web)] items-center justify-center rounded-full border shadow-sm transition-all duration-[var(--duration-base)] group-hover:scale-100 group-hover:opacity-100 [@media(hover:none)]:scale-100 [@media(hover:none)]:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
            loved
              ? "border-error bg-error-light text-error"
              : "border-border bg-card/95 text-muted-foreground hover:border-error hover:bg-error-light hover:text-error"
          }`}
          onClick={handleWishlistClick}
        >
          <Heart className="h-4 w-4" fill={loved ? "currentColor" : "none"} aria-hidden="true" />
        </button>
      </div>

      <div className="p-3">
        <Link
          to={`/product/${product.id}`}
          onClick={onNavigate}
          className="block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <h3 className="mb-1.5 min-h-[2.5rem] line-clamp-2 text-sm font-medium leading-snug text-foreground">
            {product.name}
          </h3>
          <div className="mb-1.5 flex flex-wrap items-baseline gap-1.5">
            <span className="text-[var(--text-base)] font-bold text-primary">
              {formatPrice(product.price)}
            </span>
            {product.originalPrice ? (
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(product.originalPrice)}
              </span>
            ) : null}
            {product.discount ? (
              <span className="rounded bg-error-light px-1.5 py-0.5 text-[11px] font-semibold text-error">
                -{product.discount}%
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-accent text-accent" aria-hidden="true" />
              <span className="font-medium text-foreground">{product.rating}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>{t("productCard.reviewsCount", { count: product.reviewCount })}</span>
            <span aria-hidden="true">·</span>
            <span>{t("product.soldCountShort", { count: formatSoldCount(product.sold) })}</span>
          </div>
        </Link>
      </div>
    </motion.article>
  );
});
