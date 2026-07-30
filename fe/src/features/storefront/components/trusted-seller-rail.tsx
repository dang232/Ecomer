import { Star, Store } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { HorizontalRail } from "@/shared/commerce";

import type { HomeMarketplaceView } from "../model/home-view";

export interface TrustedSellerRailProps {
  sellers: HomeMarketplaceView["featuredSellers"];
}

export function TrustedSellerRail({ sellers }: TrustedSellerRailProps) {
  const { t } = useTranslation();
  if (sellers.length === 0) return null;

  return (
    <HorizontalRail title={t("storefront.sellers.title")}>
      {sellers.map((seller) => (
        <Link
          key={seller.id}
          to={seller.href}
          className="grid min-h-32 snap-start content-center gap-2 border border-border bg-card p-4 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Store className="h-6 w-6 text-primary" aria-hidden="true" />
          <span className="line-clamp-2 text-sm font-semibold text-foreground">{seller.name}</span>
          {seller.rating !== undefined ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Star
                className="h-3.5 w-3.5 fill-[var(--color-rating)] text-[var(--color-rating)]"
                aria-hidden="true"
              />
              {seller.rating.toFixed(1)}
            </span>
          ) : null}
        </Link>
      ))}
    </HorizontalRail>
  );
}
