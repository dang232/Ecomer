import { LayoutGrid } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { HorizontalRail } from "@/shared/commerce";

import type { HomeMarketplaceView } from "../model/home-view";

export interface CategoryRailProps {
  categories: HomeMarketplaceView["categories"];
}

export function CategoryRail({ categories }: CategoryRailProps) {
  const { t } = useTranslation();
  if (categories.length === 0) return null;

  return (
    <HorizontalRail title={t("storefront.categories.title")}>
      {categories.map((category) => (
        <Link
          key={category.id}
          to={category.href}
          className="flex min-h-28 snap-start flex-col items-center justify-center gap-2 border border-border bg-card px-3 text-center text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LayoutGrid className="h-5 w-5 text-primary" aria-hidden="true" />
          <span className="line-clamp-2">{category.label}</span>
        </Link>
      ))}
    </HorizontalRail>
  );
}
