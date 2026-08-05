import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ProductGrid } from "@/shared/commerce";
import { AsyncState, Button, Skeleton, Surface } from "@/shared/ui";

import type { SearchResultsView } from "../model/search-view";

export interface SearchResultsProps {
  view: SearchResultsView;
  onRetry: () => void;
  onClearFilters?: () => void;
  onProductNavigate?: () => void;
}

const skeletonIds = Array.from({ length: 10 }, (_, index) => `search-product-${index}`);

function ResultsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {skeletonIds.map((id) => (
        <div
          key={id}
          className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-card"
        >
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SearchResults({
  view,
  onRetry,
  onClearFilters,
  onProductNavigate,
}: SearchResultsProps) {
  const { t } = useTranslation();
  const status = view.status === "partial" ? "ready" : view.status;

  return (
    <AsyncState
      status={status}
      retry={{ label: t("common.tryAgain", { defaultValue: "Try again" }), onClick: onRetry }}
      loading={<ResultsSkeleton />}
      error={
        <Surface padding="lg" className="w-full py-16 text-center sm:py-20">
          <Search className="mx-auto mb-4 h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-foreground">
            {t("search.errorTitle", { defaultValue: "Products could not be loaded" })}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {t("search.errorDescription", {
              defaultValue: "Check your connection, then try loading the results again.",
            })}
          </p>
        </Surface>
      }
      empty={
        <Surface padding="lg" className="py-16 text-center sm:py-20">
          <Search className="mx-auto mb-4 h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-foreground">
            {t("search.emptyTitle", { defaultValue: "No products found" })}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {t("search.emptySub", {
              defaultValue: "Try removing a filter or searching for a different product.",
            })}
          </p>
          <Button
            variant={onClearFilters ? "primary" : "outline"}
            onClick={onClearFilters ?? onRetry}
            className="mt-6"
          >
            {onClearFilters
              ? t("search.emptyClear", { defaultValue: "Clear filters" })
              : t("common.refresh", { defaultValue: "Refresh" })}
          </Button>
        </Surface>
      }
    >
      <div onClickCapture={onProductNavigate ? onProductNavigate : undefined}>
        <ProductGrid products={view.products} />
      </div>
    </AsyncState>
  );
}
