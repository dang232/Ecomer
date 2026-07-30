import { useTranslation } from "react-i18next";

import { Button, Surface } from "@/shared/ui";

import type { SearchResultsView } from "../model/search-view";
import type { SearchRouteState } from "../search-route-state";

export interface SearchToolbarProps {
  state: SearchRouteState;
  view: Pick<SearchResultsView, "status" | "query" | "resultCount" | "source">;
  onChange: (updates: Partial<SearchRouteState>) => void;
}

export function SearchToolbar({ state, view, onChange }: SearchToolbarProps) {
  const { t } = useTranslation();
  const options: readonly { value: SearchRouteState["sort"]; label: string }[] = [
    { value: "popular", label: t("search.sort.shortPopular") },
    { value: "price-low", label: t("search.sort.shortPriceLow") },
    { value: "price-high", label: t("search.sort.shortPriceHigh") },
    { value: "newest", label: t("search.sort.shortNewest") },
  ];

  const resultLabel =
    view.status === "loading"
      ? t("search.loading", { defaultValue: "Loading products..." })
      : view.status === "error"
        ? t("search.resultsUnavailable", { defaultValue: "Results unavailable" })
        : view.query
          ? t("search.productCountForQuery", {
              count: view.resultCount,
              query: view.query,
              defaultValue: "{{count}} results for '{{query}}'",
            })
          : t("search.productCount", {
              count: view.resultCount,
              defaultValue: "{{count}} products",
            });

  return (
    <Surface
      padding="sm"
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p aria-live="polite" aria-atomic="true" className="min-w-0 text-sm text-muted-foreground">
        {resultLabel}
        {view.source === "fallback" && view.status !== "error" ? (
          <span className="ml-2 text-[var(--color-warning-text)]">
            {t("search.fallbackLabel", { defaultValue: "Showing catalog results" })}
          </span>
        ) : null}
      </p>
      <div
        role="group"
        aria-label={t("search.sortLabel", { defaultValue: "Sort products" })}
        className="flex max-w-full shrink-0 gap-1 overflow-x-auto rounded-[var(--radius-control)] border border-border bg-muted p-1"
      >
        {options.map((option) => (
          <Button
            key={option.value}
            variant={state.sort === option.value ? "primary" : "ghost"}
            size="sm"
            aria-pressed={state.sort === option.value}
            onClick={() => onChange({ sort: option.value })}
            className="shrink-0 border-transparent px-3 text-xs shadow-none"
          >
            {option.label}
          </Button>
        ))}
      </div>
    </Surface>
  );
}
