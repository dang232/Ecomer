import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { ProductTile, type ProductTileView } from "@/shared/commerce";
import { formatPrice } from "@/shared/lib";
import { ImageWithFallback } from "@/shared/ui";

import type { HomeMarketplaceView } from "../model/home-view";

export interface CampaignBandProps {
  campaign: HomeMarketplaceView["campaign"];
  secondaryProducts: readonly ProductTileView[];
}

export function CampaignBand({ campaign, secondaryProducts }: CampaignBandProps) {
  const { t } = useTranslation();

  if (!campaign) return null;

  return (
    <section
      aria-labelledby="campaign-heading"
      className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)]"
    >
      <Link
        to={campaign.href}
        className="group relative block min-h-60 overflow-hidden border border-border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ImageWithFallback
          src={campaign.imageUrl}
          alt={campaign.title}
          priority
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-[var(--duration-base)] motion-reduce:transform-none group-hover:scale-105"
          imagePreset="detail"
          sizes="(min-width: 640px) 50vw, 100vw"
        />
        <div className="absolute inset-0 bg-black/45" aria-hidden="true" />
        <div className="relative flex min-h-60 max-w-xl flex-col justify-end p-5 text-white sm:p-7">
          <p className="text-xs font-semibold uppercase">{t("storefront.campaign.eyebrow")}</p>
          <h1 id="campaign-heading" className="mt-2 text-2xl font-bold sm:text-3xl">
            {campaign.title}
          </h1>
          <p className="mt-3 text-base font-semibold">{formatPrice(campaign.priceVnd)}</p>
          <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold">
            {t("storefront.campaign.action")}
            <ArrowRight
              className="h-4 w-4 transition-transform duration-[var(--duration-fast)] motion-reduce:transform-none group-hover:translate-x-1"
              aria-hidden="true"
            />
          </span>
        </div>
      </Link>
      <div className="hidden grid-cols-2 gap-3 md:grid">
        {secondaryProducts.map((product) => (
          <ProductTile key={product.id} product={product} href={`/product/${product.id}`} />
        ))}
      </div>
    </section>
  );
}
