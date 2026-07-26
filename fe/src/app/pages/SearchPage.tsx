import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { SearchFilters } from "../../features/catalog/components/search-filters";
import {
  resolveSearchDataSource,
  resolveSearchDisplayState,
} from "../../features/catalog/search-display-state";
import {
  clearSearchFilters,
  readSearchRouteState,
  updateSearchRouteState,
  type SearchRouteState,
} from "../../features/catalog/search-route-state";
import { AsyncState } from "../../shared/ui/async-state";
import { Button } from "../../shared/ui/button";
import { Dialog } from "../../shared/ui/dialog";
import { Skeleton } from "../../shared/ui/skeleton";
import { Surface } from "../../shared/ui/surface";
import { ProductCard } from "../components/product-card";
import { categoryDisplayLabel, useCategories } from "../hooks/use-categories";
import { useProductsV2 } from "../hooks/use-products-v2";
import { useSearchV2 } from "../hooks/use-search-v2";
import { catalogV2Enabled } from "../lib/api/catalog-flags";
import { flattenCategoryTree } from "../lib/api/endpoints/categories";
import { fromServer } from "../lib/api/product-mapper";
import { canUseCatalogBrowse, mergeMissingProductImages } from "../lib/search-view";
import {
  requiresBackendSearch,
  shouldFallbackToCatalog,
  validatePriceRange,
  type PriceRangeError,
} from "../lib/search-view";

const getScrollKey = () => `scroll:${window.location.pathname}${window.location.search}`;

const PAGE_SIZE = 20;
const PRODUCT_SKELETON_IDS = Array.from({ length: 8 }, (_, index) => `product-skeleton-${index}`);

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
      {PRODUCT_SKELETON_IDS.map((id) => (
        <Surface key={id} padding="none" className="overflow-hidden">
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        </Surface>
      ))}
    </div>
  );
}

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const routeState = useMemo(() => readSearchRouteState(searchParams), [searchParams]);
  const {
    q: query,
    cat: selectedCat,
    flash: isFlash,
    priceMin,
    priceMax,
    sort: sortBy,
    minRating,
    tag: selectedTags,
    sameDay,
    verifiedOnly,
    officialOnly,
    brand: selectedBrand,
    page: currentPage,
  } = routeState;
  const { t } = useTranslation();

  const [localPriceMin, setLocalPriceMin] = useState(priceMin);
  const [localPriceMax, setLocalPriceMax] = useState(priceMax);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const priceRangeError = validatePriceRange(localPriceMin, localPriceMax);
  const appliedPriceRangeError = validatePriceRange(priceMin, priceMax);
  const appliedPriceMin = appliedPriceRangeError ? "" : priceMin;
  const appliedPriceMax = appliedPriceRangeError ? "" : priceMax;
  // Price fields are drafts. Applied filters are always owned by the URL contract.
  useEffect(() => {
    setLocalPriceMin(priceMin);
    setLocalPriceMax(priceMax);
  }, [priceMin, priceMax]);

  const pageSize = PAGE_SIZE;

  const updateRoute = (
    updates: Partial<SearchRouteState>,
    options?: { resetPage?: boolean; replace?: boolean },
  ) => {
    setSearchParams(
      (previous) => updateSearchRouteState(previous, updates, { resetPage: options?.resetPage }),
      { replace: options?.replace ?? true },
    );
  };

  const setMinRating = (value: number) => updateRoute({ minRating: value });
  const setSelectedTags = (value: string[]) => updateRoute({ tag: value });
  const setSameDay = (value: boolean) => updateRoute({ sameDay: value });
  const setVerifiedOnly = (value: boolean) => updateRoute({ verifiedOnly: value });
  const setOfficialOnly = (value: boolean) => updateRoute({ officialOnly: value });
  const setSelectedBrand = (value: string) => updateRoute({ brand: value });
  const setCurrentPage = (next: number | ((current: number) => number)) => {
    const page = typeof next === "function" ? next(currentPage) : next;
    updateRoute({ page }, { resetPage: false, replace: false });
  };

  // Restore scroll on back-navigation
  useEffect(() => {
    const key = getScrollKey();
    const saved = sessionStorage.getItem(key);
    if (saved) {
      requestAnimationFrame(() => window.scrollTo(0, parseInt(saved, 10)));
      sessionStorage.removeItem(key);
    }
  }, []);

  useEffect(() => {
    if (!searchParams.has("freeShip")) return;
    const next = new URLSearchParams(searchParams);
    next.delete("freeShip");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const setPriceFromUrl = (min: string, max: string) => {
    if (validatePriceRange(min, max)) return;
    updateRoute({ priceMin: min, priceMax: max });
    setLocalPriceMin(min);
    setLocalPriceMax(max);
  };

  const priceRangeErrorMessage = (error: PriceRangeError | null) => {
    if (!error) return "";
    const messages: Record<PriceRangeError, string> = {
      "min-negative": t("search.priceMinNegative", {
        defaultValue: "Minimum price cannot be negative.",
      }),
      "max-negative": t("search.priceMaxNegative", {
        defaultValue: "Maximum price cannot be negative.",
      }),
      "min-greater-than-max": t("search.priceOrderInvalid", {
        defaultValue: "Minimum price cannot be greater than maximum price.",
      }),
      "min-invalid": t("search.priceMinInvalid", {
        defaultValue: "Enter a valid minimum price.",
      }),
      "max-invalid": t("search.priceMaxInvalid", {
        defaultValue: "Enter a valid maximum price.",
      }),
    };
    return messages[error];
  };

  const setSortBy = (value: SearchRouteState["sort"]) => updateRoute({ sort: value });

  const setCategory = (next: string) => updateRoute({ cat: next });

  const searchEnabled = requiresBackendSearch({
    query,
    category: selectedCat,
    brand: selectedBrand,
    minPrice: appliedPriceMin,
    maxPrice: appliedPriceMax,
    minRating,
    tags: selectedTags,
    sameDay,
    verifiedOnly,
    officialOnly,
    sortBy,
  });
  const catalogBrowse = canUseCatalogBrowse({
    query,
    category: selectedCat,
    brand: selectedBrand,
    minPrice: appliedPriceMin,
    maxPrice: appliedPriceMax,
    minRating,
    tags: selectedTags,
    sameDay,
    verifiedOnly,
    officialOnly,
    sortBy,
  });
  // Every supported catalog filter is sent to cursor search. The catalog path
  // is also authoritative for category-only browsing because it contains the
  // complete product set, while search-service remains the full-text path.
  const v2Eligible = catalogV2Enabled;
  const useV2SearchPath = v2Eligible && searchEnabled && !catalogBrowse;
  const useV2CatalogPath = v2Eligible && (!searchEnabled || catalogBrowse);
  const v2Params = {
    q: query || undefined,
    category: selectedCat || undefined,
    brand: selectedBrand || undefined,
    minPrice: appliedPriceMin ? Number(appliedPriceMin) * 1000 : undefined,
    maxPrice: appliedPriceMax ? Number(appliedPriceMax) * 1000 : undefined,
    minRating: minRating > 0 ? minRating : undefined,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    // V2 has no popularity metric yet; its default deterministic order is newest.
    sort: sortBy === "popular" ? undefined : sortBy,
    sameDay: sameDay || undefined,
    verifiedOnly: verifiedOnly || undefined,
    officialOnly: officialOnly || undefined,
    limit: pageSize,
  };
  const searchV2 = useSearchV2({ ...v2Params, includeFacets: true }, useV2SearchPath);
  const v2SearchProducts = useMemo(() => {
    const seen = new Set<string>();
    return (searchV2.data?.pages.flatMap((page) => page.data.items) ?? [])
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .map(fromServer);
  }, [searchV2.data]);
  const searchResultLoading = searchV2.isFetching && !searchV2.isFetchingNextPage;
  const searchPlaceholderLoading = searchResultLoading && searchV2.isPlaceholderData;
  const catalogFallbackCandidate =
    useV2SearchPath && !searchResultLoading && !searchV2.error && v2SearchProducts.length === 0;
  const searchNeedsImageHydration =
    useV2SearchPath && v2SearchProducts.some((product) => !product.image);
  const productsV2 = useProductsV2(
    v2Params,
    useV2CatalogPath || catalogFallbackCandidate || searchNeedsImageHydration,
  );
  const v2CatalogProducts = useMemo(() => {
    const seen = new Set<string>();
    return (productsV2.data?.pages.flatMap((page) => page.data.items) ?? [])
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .map(fromServer);
  }, [productsV2.data]);
  const hydratedSearchProducts = useMemo(
    () => mergeMissingProductImages(v2SearchProducts, v2CatalogProducts),
    [v2CatalogProducts, v2SearchProducts],
  );
  const catalogResultLoading = productsV2.isFetching && !productsV2.isFetchingNextPage;
  const catalogPlaceholderLoading = catalogResultLoading && productsV2.isPlaceholderData;
  const catalogFallbackActive =
    catalogFallbackCandidate &&
    !productsV2.error &&
    shouldFallbackToCatalog({
      isLoading: searchResultLoading,
      hasError: Boolean(searchV2.error),
      totalElements: v2SearchProducts.length,
      localCatalogCount: v2CatalogProducts.length,
      localCatalogLoading: productsV2.isFetching && !productsV2.isFetchingNextPage,
    });
  // A filtered view normally uses search-service V2. If it returns a healthy
  // empty page, warm product-service V2 and use it only for that visibility gap.
  const v2SearchActive = useV2SearchPath;
  const v2CatalogActive = useV2CatalogPath || catalogFallbackActive;
  const imageHydrationActive = v2SearchActive && searchNeedsImageHydration;
  const facets = searchV2.data?.pages[0]?.data.facets ?? { categories: [], brands: [], tags: [] };
  const backendProducts = v2SearchActive ? hydratedSearchProducts : [];
  const backendLoading = v2SearchActive && searchResultLoading;
  const backendHasError = v2SearchActive && Boolean(searchV2.error);
  const backendTotalElements = v2SearchProducts.length;
  const catalogProducts = v2CatalogActive ? v2CatalogProducts : [];
  const catalogLoading = v2CatalogActive && catalogResultLoading;
  const catalogHasError = v2CatalogActive && Boolean(productsV2.error);
  const { data: categories = [] } = useCategories();
  const flatCategories = useMemo(() => flattenCategoryTree(categories), [categories]);

  const sourceState = resolveSearchDataSource({
    searchEnabled: useV2SearchPath,
    searchLoading: backendLoading,
    searchHasError: backendHasError,
    searchTotalElements: backendTotalElements,
    searchProductCount: backendProducts.length,
    catalogProductCount: catalogProducts.length,
    catalogFallbackActive,
  });
  const usedBackend = sourceState.source === "search";
  const catalog = usedBackend ? backendProducts : catalogProducts;
  // V2 is the only displayed source. A failed or empty V2 result remains an
  // explicit error/empty state instead of silently switching to legacy data.
  const v2DisplayActive = (v2SearchActive && usedBackend) || (v2CatalogActive && !usedBackend);
  const imageHydrationLoading =
    imageHydrationActive &&
    catalogResultLoading &&
    hydratedSearchProducts.some((product) => !product.image);

  const filtered = useMemo(() => {
    if (v2DisplayActive && !isFlash) return catalog;
    let list = [...catalog];
    if (isFlash) list = list.filter((p) => (p.discount ?? 0) >= 20 || p.badge === "flash");
    if (!usedBackend) {
      if (selectedCat) list = list.filter((p) => p.category === selectedCat);
      if (selectedBrand) list = list.filter((p) => p.brand === selectedBrand);
      if (query) {
        const q = query.toLowerCase();
        list = list.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            p.tags.some((tag) => tag.includes(q)),
        );
      }
    }
    if (appliedPriceMin) list = list.filter((p) => p.price >= Number(appliedPriceMin) * 1000);
    if (appliedPriceMax) list = list.filter((p) => p.price <= Number(appliedPriceMax) * 1000);
    if (!usedBackend && minRating > 0) list = list.filter((p) => p.rating >= minRating);
    if (!usedBackend && selectedTags.length > 0) {
      list = list.filter((p) => selectedTags.some((tag) => p.tags.includes(tag)));
    }
    if (sameDay) list = list.filter((p) => p.sameDayDelivery);
    if (verifiedOnly) list = list.filter((p) => p.verified);
    if (officialOnly) list = list.filter((p) => p.isOfficial);
    switch (sortBy) {
      case "price-low":
        list.sort((a, b) => a.price - b.price);
        break;
      case "price-high":
        list.sort((a, b) => b.price - a.price);
        break;
      case "newest":
        list.sort((a, b) => (b.badge === "new" ? 1 : 0) - (a.badge === "new" ? 1 : 0));
        break;
      default:
        list.sort((a, b) => b.sold - a.sold);
    }
    return list;
  }, [
    catalog,
    v2DisplayActive,
    usedBackend,
    query,
    selectedCat,
    selectedBrand,
    appliedPriceMin,
    appliedPriceMax,
    minRating,
    selectedTags,
    sameDay,
    verifiedOnly,
    officialOnly,
    sortBy,
    isFlash,
  ]);

  // V2 owns pagination through cursors; local slicing is retained only for the
  // campaign-only flash view and the unfiltered catalog fallback.
  const totalCount = v2DisplayActive
    ? filtered.length
    : usedBackend
      ? backendTotalElements
      : filtered.length;
  const totalPages = v2DisplayActive ? 1 : Math.max(1, Math.ceil(totalCount / pageSize));
  const paginated = v2DisplayActive
    ? filtered
    : filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const placeholderLoading =
    (v2SearchActive && searchPlaceholderLoading) ||
    (v2CatalogActive && catalogPlaceholderLoading) ||
    imageHydrationLoading;
  const displayState = resolveSearchDisplayState({
    searchEnabled: useV2SearchPath,
    searchLoading: backendLoading,
    searchHasError: backendHasError,
    searchTotalElements: backendTotalElements,
    searchProductCount: backendProducts.length,
    catalogLoading,
    catalogHasError,
    catalogProductCount: catalogProducts.length,
    visibleProductCount: placeholderLoading ? 0 : paginated.length,
    catalogFallbackActive,
  });

  const retryResults = () => {
    const requests: Promise<unknown>[] = [];
    if (useV2SearchPath) requests.push(searchV2.refetch());
    if (useV2CatalogPath || catalogFallbackCandidate || imageHydrationActive) {
      requests.push(productsV2.refetch());
    }
    void Promise.allSettled(requests);
  };
  const v2HasMore =
    v2DisplayActive && (v2SearchActive ? searchV2.hasNextPage : productsV2.hasNextPage);
  const v2FetchingNext =
    v2DisplayActive && v2SearchActive
      ? searchV2.isFetchingNextPage
      : v2DisplayActive && productsV2.isFetchingNextPage;
  const loadNextV2Page = () => {
    if (v2SearchActive) {
      void searchV2.fetchNextPage();
    } else if (v2CatalogActive) {
      void productsV2.fetchNextPage();
    }
  };

  const clearFilters = () => {
    setLocalPriceMin("");
    setLocalPriceMax("");
    setFiltersOpen(false);
    setSearchParams((previous) => clearSearchFilters(previous), { replace: true });
  };

  const activeFilters: { label: string; onRemove: () => void }[] = [];
  if (selectedCat) {
    const cat = flatCategories.find((c) => c.id === selectedCat);
    activeFilters.push({
      label: cat ? categoryDisplayLabel(cat) : selectedCat,
      onRemove: () => setCategory(""),
    });
  }
  if (selectedBrand) {
    activeFilters.push({ label: selectedBrand, onRemove: () => setSelectedBrand("") });
  }
  if (appliedPriceMin || appliedPriceMax) {
    activeFilters.push({
      label: `${appliedPriceMin ? `${appliedPriceMin}k` : "0"} â€“ ${appliedPriceMax ? `${appliedPriceMax}k` : "âˆž"}`,
      onRemove: () => setPriceFromUrl("", ""),
    });
  }
  if (minRating > 0) {
    activeFilters.push({
      label: t("search.ratingAtLeast", { r: minRating }),
      onRemove: () => setMinRating(0),
    });
  }
  for (const tag of selectedTags) {
    activeFilters.push({
      label: tag,
      onRemove: () => setSelectedTags(selectedTags.filter((value) => value !== tag)),
    });
  }
  if (sameDay) {
    activeFilters.push({
      label: t("search.sameDayDelivery", { defaultValue: "Same-day delivery" }),
      onRemove: () => setSameDay(false),
    });
  }
  if (verifiedOnly) {
    activeFilters.push({
      label: t("search.verifiedOnly", { defaultValue: "Verified sellers" }),
      onRemove: () => setVerifiedOnly(false),
    });
  }
  if (officialOnly) {
    activeFilters.push({
      label: t("search.officialStores", { defaultValue: "Official stores" }),
      onRemove: () => setOfficialOnly(false),
    });
  }

  const sortOptions: readonly { v: SearchRouteState["sort"]; l: string }[] = [
    { v: "popular", l: t("search.sort.shortPopular") },
    { v: "price-low", l: t("search.sort.shortPriceLow") },
    { v: "price-high", l: t("search.sort.shortPriceHigh") },
    { v: "newest", l: t("search.sort.shortNewest") },
  ];

  const filterProps = {
    categories: flatCategories,
    facets,
    values: {
      selectedCategory: selectedCat,
      selectedBrand,
      priceMin: localPriceMin,
      priceMax: localPriceMax,
      minRating,
      selectedTags,
      sameDay,
      verifiedOnly,
      officialOnly,
    },
    hasActiveFilters: activeFilters.length > 0,
    priceError: priceRangeErrorMessage(priceRangeError) || null,
    onClear: clearFilters,
    onCategoryChange: setCategory,
    onBrandChange: setSelectedBrand,
    onPriceMinChange: setLocalPriceMin,
    onPriceMaxChange: setLocalPriceMax,
    onApplyPrice: () => setPriceFromUrl(localPriceMin, localPriceMax),
    onRatingChange: setMinRating,
    onTagsChange: setSelectedTags,
    onSameDayChange: setSameDay,
    onVerifiedChange: setVerifiedOnly,
    onOfficialChange: setOfficialOnly,
  };

  // Pagination helper: build page numbers with ellipsis
  const getPageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [];
    pages.push(1);
    if (currentPage > 3) pages.push("...");
    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(totalPages - 1, currentPage + 1);
      i++
    ) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  };

  return (
    <div className="max-w-[1400px] mx-auto py-6 px-[var(--content-padding)]">
      {/* Page heading for screen readers */}
      <h1 className="sr-only">
        {query
          ? t("search.resultsForQuery", { query, defaultValue: `Search results for "${query}"` })
          : t("search.allProducts", { defaultValue: "All Products" })}
      </h1>

      <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
        <Button
          variant="outline"
          aria-label={t("search.openFilters", { defaultValue: "Open filters" })}
          onClick={() => setFiltersOpen(true)}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          {t("search.filtersTitle", { defaultValue: "Filters" })}
          {activeFilters.length > 0 ? (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
              {activeFilters.length}
            </span>
          ) : null}
        </Button>
      </div>

      <Dialog
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title={t("search.filtersTitle", { defaultValue: "Filters" })}
        closeLabel={t("search.closeFilters", { defaultValue: "Close filters" })}
        size="md"
        scrollable
        footer={
          <Button onClick={() => setFiltersOpen(false)} className="w-full sm:w-auto">
            {t("search.showResults", { defaultValue: "Show results" })}
          </Button>
        }
      >
        <SearchFilters idPrefix="mobile" {...filterProps} />
      </Dialog>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <Surface padding="md" className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
            <SearchFilters idPrefix="desktop" {...filterProps} />
          </Surface>
        </aside>

        {/* â”€â”€ Results Area â”€â”€ */}
        <div className="min-w-0">
          {activeFilters.length > 0 ? (
            <div
              className="mb-4 flex flex-wrap gap-2"
              aria-label={t("search.activeFilters", { defaultValue: "Active filters" })}
            >
              {activeFilters.map((f) => (
                <Button
                  key={f.label}
                  variant="ghost"
                  size="sm"
                  onClick={f.onRemove}
                  className="rounded-full border-primary/15 bg-primary-light text-xs text-primary hover:border-error/20 hover:bg-error/10 hover:text-error"
                >
                  {f.label}
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              ))}
            </div>
          ) : null}

          <Surface
            padding="sm"
            className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <p
              aria-live="polite"
              aria-atomic="true"
              className="min-w-0 text-sm text-muted-foreground"
            >
              {displayState.status === "loading"
                ? t("search.loading", { defaultValue: "Loading productsâ€¦" })
                : displayState.status === "error"
                  ? t("search.resultsUnavailable", { defaultValue: "Results unavailable" })
                  : v2DisplayActive
                    ? t("search.showingLoaded", {
                        count: totalCount,
                        defaultValue: "Showing {{count}} loaded products",
                      })
                    : query && totalCount > 0
                      ? t("search.showingRange", {
                          start: (currentPage - 1) * pageSize + 1,
                          end: Math.min(currentPage * pageSize, totalCount),
                          total: totalCount,
                          query,
                          defaultValue:
                            "Showing {{start}}â€“{{end}} of {{total}} results for '{{query}}'",
                        })
                      : query
                        ? t("search.noResultsFor", {
                            query,
                            defaultValue: "No results for '{{query}}'",
                          })
                        : t("search.productCount", {
                            count: totalCount,
                            defaultValue: "{{count}} products",
                          })}
            </p>

            <div
              role="group"
              aria-label={t("search.sortLabel", { defaultValue: "Sort products" })}
              className="flex max-w-full shrink-0 gap-1 overflow-x-auto rounded-[var(--radius-control)] border border-border bg-muted p-1"
            >
              {sortOptions.map((opt) => {
                const active = sortBy === opt.v;
                return (
                  <Button
                    key={opt.v}
                    variant={active ? "primary" : "ghost"}
                    size="sm"
                    aria-pressed={active}
                    onClick={() => setSortBy(opt.v)}
                    className="shrink-0 border-transparent px-3 text-xs shadow-none"
                  >
                    {opt.l}
                  </Button>
                );
              })}
            </div>
          </Surface>

          {displayState.notice && displayState.status === "ready" ? (
            <Surface
              padding="sm"
              role="status"
              aria-live="polite"
              className="mb-4 flex flex-col gap-3 border-warning/40 bg-warning-light sm:flex-row sm:items-center"
            >
              <AlertTriangle
                className="h-5 w-5 shrink-0 text-[var(--color-warning-text)]"
                aria-hidden="true"
              />
              <p className="min-w-0 flex-1 text-sm text-[var(--color-warning-text)]">
                {t("search.fallbackUnavailable", {
                  defaultValue:
                    "Search is temporarily unavailable. Showing previously loaded results.",
                })}
              </p>
              <Button variant="ghost" size="sm" onClick={retryResults} className="shrink-0">
                {t("common.refresh", { defaultValue: "Refresh" })}
              </Button>
            </Surface>
          ) : null}

          <AsyncState
            status={displayState.status}
            retry={{
              label: t("common.tryAgain", { defaultValue: "Try again" }),
              onClick: retryResults,
            }}
            loading={<ProductGridSkeleton />}
            error={
              <Surface padding="lg" className="w-full py-16 text-center sm:py-20">
                <Search
                  className="mx-auto mb-4 h-10 w-10 text-muted-foreground"
                  aria-hidden="true"
                />
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
                <Search
                  className="mx-auto mb-4 h-10 w-10 text-muted-foreground"
                  aria-hidden="true"
                />
                <h2 className="text-lg font-semibold text-foreground">
                  {t("search.emptyTitle", { defaultValue: "No products found" })}
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                  {t("search.emptySub", {
                    defaultValue: "Try removing a filter or searching for a different product.",
                  })}
                </p>
                <Button
                  variant={activeFilters.length > 0 ? "primary" : "outline"}
                  onClick={activeFilters.length > 0 ? clearFilters : retryResults}
                  className="mt-6"
                >
                  {activeFilters.length > 0
                    ? t("search.emptyClear", { defaultValue: "Clear filters" })
                    : t("common.refresh", { defaultValue: "Refresh" })}
                </Button>
              </Surface>
            }
          >
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
              {paginated.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  index={index}
                  onNavigate={() => {
                    sessionStorage.setItem(getScrollKey(), String(window.scrollY));
                  }}
                />
              ))}
            </div>
          </AsyncState>

          {/* Pagination */}
          {v2DisplayActive && displayState.status === "ready" && v2HasMore ? (
            <div className="mt-8 flex justify-center">
              <Button variant="outline" onClick={loadNextV2Page} disabled={v2FetchingNext}>
                {v2FetchingNext
                  ? t("search.loadingMore", { defaultValue: "Loading more..." })
                  : t("search.loadMore", { defaultValue: "Load more" })}
              </Button>
            </div>
          ) : !v2DisplayActive && displayState.status === "ready" && totalPages > 1 ? (
            <nav aria-label="Pagination" className="flex items-center justify-center gap-1 mt-8">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                aria-label="Previous page"
                className="w-9 h-9 flex items-center justify-center border border-border rounded-[var(--radius-md)] text-sm font-medium text-text-secondary hover:border-primary hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>

              {getPageNumbers().map((page, idx) =>
                page === "..." ? (
                  <span
                    key={`ellipsis-${idx}`} // eslint-disable-line react/no-array-index-key
                    className="w-9 h-9 flex items-center justify-center text-sm text-muted-foreground"
                  >
                    â€¦
                  </span>
                ) : (
                  <button
                    key={page}
                    onClick={() => {
                      if (typeof page === "number") setCurrentPage(page);
                    }}
                    aria-current={currentPage === page ? "page" : undefined}
                    className={`w-9 h-9 flex items-center justify-center border rounded-[var(--radius-md)] text-sm font-medium transition-colors ${
                      currentPage === page
                        ? "bg-primary text-white border-primary"
                        : "border-border text-text-secondary hover:border-primary hover:text-primary"
                    }`}
                  >
                    {page}
                  </button>
                ),
              )}

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                aria-label="Next page"
                className="w-9 h-9 flex items-center justify-center border border-border rounded-[var(--radius-md)] text-sm font-medium text-text-secondary hover:border-primary hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </nav>
          ) : null}
        </div>
      </div>
    </div>
  );
}
