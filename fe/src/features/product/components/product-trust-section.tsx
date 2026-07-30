import { MessageCircle, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { TrustCues } from "@/shared/commerce";
import { Skeleton } from "@/shared/ui";

import type { ProductDetailView } from "../model/product-view";

export interface ProductTrustSectionProps {
  view: Pick<ProductDetailView, "seller" | "trustCues">;
}

export function ProductTrustSection({ view }: ProductTrustSectionProps) {
  const { t } = useTranslation();

  return (
    <section
      className="space-y-4 border-y border-border py-5"
      aria-label={t("product.purchaseAssurances", { defaultValue: "Purchase assurances" })}
    >
      <TrustCues cues={view.trustCues} />
      {view.seller.status === "loading" ? (
        <div
          className="flex min-h-16 items-center gap-3 border-t border-border pt-4"
          data-testid="product-seller-skeleton"
        >
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ) : null}
      {view.seller.status === "ready" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              {t("product.soldBy", { defaultValue: "Sold by" })}
            </p>
            <Link
              to={`/sellers/${view.seller.id}`}
              className="mt-1 inline-flex items-center gap-2 font-semibold text-foreground hover:text-primary"
            >
              {view.seller.name}
              {view.seller.rating !== undefined ? (
                <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                  <Star
                    className="h-3.5 w-3.5 text-[var(--rating)]"
                    fill="currentColor"
                    aria-hidden="true"
                  />
                  {view.seller.rating.toFixed(1)}
                </span>
              ) : null}
            </Link>
          </div>
          <Link
            to={`/messages?seller=${encodeURIComponent(view.seller.id)}`}
            className="inline-flex min-h-[var(--target-web)] items-center justify-center gap-2 rounded-[var(--radius-control)] border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            {t("product.contactSeller", { defaultValue: "Contact seller" })}
          </Link>
        </div>
      ) : null}
    </section>
  );
}
