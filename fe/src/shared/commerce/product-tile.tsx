import { Link } from "react-router";

import { ImageWithFallback, StatusIndicator } from "@/shared/ui";

import { Price } from "./price";
import { Rating } from "./rating";
import { SellerIdentity } from "./seller-identity";

export interface ProductTileView {
  id: string;
  name: string;
  imageUrl?: string;
  priceVnd: number;
  originalPriceVnd?: number;
  rating?: number;
  soldCount?: number;
  sellerName?: string;
  stockState: "in-stock" | "low-stock" | "unavailable";
}

export interface ProductTileProps {
  product: ProductTileView;
  href: string;
}

const stockLabels: Record<Exclude<ProductTileView["stockState"], "in-stock">, string> = {
  "low-stock": "Low stock",
  unavailable: "Unavailable",
};

export function ProductTile({ product, href }: ProductTileProps) {
  const stockLabel = product.stockState === "in-stock" ? null : stockLabels[product.stockState];

  return (
    <article
      className="grid h-full min-h-[22rem] grid-rows-[auto_minmax(3rem,auto)_auto_auto] overflow-hidden rounded-[var(--radius-card)] border border-border bg-card"
      data-testid="product-tile"
    >
      <Link
        to={href}
        aria-label={product.name}
        className="group aspect-square overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <ImageWithFallback
          className="h-full w-full object-cover transition-transform duration-[var(--duration-base)] motion-reduce:transform-none group-hover:scale-105"
          src={product.imageUrl ?? ""}
          alt=""
        />
      </Link>
      <h3 className="min-h-12 px-3 pt-3 text-sm font-medium leading-5 text-foreground">
        <span className="line-clamp-2">{product.name}</span>
      </h3>
      <Price priceVnd={product.priceVnd} originalPriceVnd={product.originalPriceVnd} />
      <div className="min-h-11 px-3 pb-3">
        <Rating value={product.rating} soldCount={product.soldCount} />
        {product.sellerName ? <SellerIdentity name={product.sellerName} /> : null}
        {stockLabel ? (
          <div className="mt-2">
            <StatusIndicator tone={product.stockState === "unavailable" ? "danger" : "warning"}>
              {stockLabel}
            </StatusIndicator>
          </div>
        ) : null}
      </div>
    </article>
  );
}
