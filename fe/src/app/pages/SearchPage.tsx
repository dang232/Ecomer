import { SlidersHorizontal, Star, X, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { motion } from "motion/react";
import { useState, useMemo, useEffect, memo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router";

import { FacetList } from "../components/facet-list";
import { ImageWithFallback } from "../components/image-with-fallback";
import { useVNShop } from "../components/vnshop-context";
import { categoryDisplayLabel, useCategories } from "../hooks/use-categories";
import { useProducts } from "../hooks/use-products";
import { useResettableState } from "../hooks/use-resettable-state";
import { useSearch } from "../hooks/use-search";
import { useSearchFacets } from "../hooks/use-search-facets";
import { formatPrice } from "../lib/format";
import type { Product } from "../types/ui";

const getScrollKey = () => `scroll:${window.location.pathname}${window.location.search}`;

const ProductCard = memo(function ProductCard({ product, index }: { product: Product; index: number }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toggleWishlist, isWishlisted } = useVNShop();
  const [hovered, setHovered] = useState(false);
  const loved = isWishlisted(product.id);

  const handleNav = () => {
    sessionStorage.setItem(getScrollKey(), String(window.scrollY));
    void navigate(`/product/${product.id}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.5) }}
      role="link"
      tabIndex={0}
      aria-label={product.name}
      className="bg-card border border-border rounded-[var(--radius-lg)] overflow-hidden cursor-pointer hover:border-border-hover hover:shadow-lg hover:-translate-y-1 transition-all group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleNav}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleNav();
        }
      }}
    >
      {/* Image area */}
      <div className="relative aspect-square bg-surface-elevated overflow-hidden flex items-center justify-center">
        <ImageWithFallback
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />

        {/* Badge top-left */}
        {product.discount ? (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-error text-white text-[10px] font-bold">
            -{product.discount}%
          </span>
        ) : product.badge === "new" ? (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold">
            New
          </span>
        ) : null}

        {/* Wishlist top-right */}
        <button
          aria-label={loved ? "Remove from wishlist" : "Add to wishlist"}
          className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center shadow transition-all ${
            hovered || loved ? "opacity-100" : "opacity-0"
          } ${loved ? "bg-error text-white" : "bg-card/90 text-muted-foreground hover:bg-error hover:text-white"}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleWishlist(product.id);
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill={loved ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="p-3">
        <h3 className="text-sm font-medium text-foreground line-clamp-2 mb-1.5">{product.name}</h3>
        <div className="flex items-center gap-1 mb-1.5">
          <Star size={11} fill="var(--warning)" className="text-amber-400 shrink-0" />
          <span className="text-xs text-foreground">{product.rating}</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">
            {(() => { const s: number = product.sold ?? 0; const formatted = s > 999 ? `${(s / 1000).toFixed(1)}k` : `${s}`; return t("product.soldCountShort", { count: formatted }); })()}
          </span>
        </div>
        <div className="flex items-end gap-1.5">
          <p className="text-sm font-bold text-primary">{formatPrice(product.price)}</p>
          {product.originalPrice ? (
            <p className="text-[11px] text-muted-foreground line-through">
              {formatPrice(product.originalPrice)}
            </p>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
});

const PAGE_SIZE = 20;

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const selectedCat = searchParams.get("cat") ?? "";
  const isFlash = searchParams.get("flash") === "true";
  const { t } = useTranslation();

  const priceMin = searchParams.get("priceMin") ?? "";
  const priceMax = searchParams.get("priceMax") ?? "";
  const sortBy = searchParams.get("sort") ?? "popular";

  const [localPriceMin, setLocalPriceMin] = useState(priceMin);
  const [localPriceMax, setLocalPriceMax] = useState(priceMax);
  const [minRating, setMinRating] = useState(() => {
    const v = searchParams.get("minRating");
    return v ? Number(v) : 0;
  });
  const [freeShipOnly, setFreeShipOnly] = useState(() => searchParams.get("freeShip") === "true");
  // NOTE: sameDay/verifiedOnly/officialOnly are initialized from URL but are only
  // applied client-side — the backend does not yet support these filters.
  const [sameDay, setSameDay] = useState(() => searchParams.get("sameDay") === "true");
  const [verifiedOnly, setVerifiedOnly] = useState(() => searchParams.get("verifiedOnly") === "true");
  const [officialOnly, setOfficialOnly] = useState(() => searchParams.get("officialOnly") === "true");
  const [selectedBrand, setSelectedBrand] = useState(() => searchParams.get("brand") ?? "");

  // Sync filter state to URL params so deep-links and browser back work correctly.
  useEffect(() => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (minRating > 0) p.set("minRating", String(minRating)); else p.delete("minRating");
      if (freeShipOnly) p.set("freeShip", "true"); else p.delete("freeShip");
      if (selectedBrand) p.set("brand", selectedBrand); else p.delete("brand");
      if (sameDay) p.set("sameDay", "true"); else p.delete("sameDay");
      if (verifiedOnly) p.set("verifiedOnly", "true"); else p.delete("verifiedOnly");
      if (officialOnly) p.set("officialOnly", "true"); else p.delete("officialOnly");
      // Only update if actually different to avoid infinite loop
      if (p.toString() === prev.toString()) return prev;
      return p;
    }, { replace: true });
  }, [minRating, freeShipOnly, selectedBrand, sameDay, verifiedOnly, officialOnly, setSearchParams]);

  // Current page for pagination
  const filterSignature = `${query}|${selectedCat}|${selectedBrand}|${priceMin}|${priceMax}|${minRating}|${freeShipOnly}|${sameDay}|${verifiedOnly}|${officialOnly}|${sortBy}|${isFlash}`;
  const [currentPage, setCurrentPage] = useResettableState(1, filterSignature);
  const [pageSize] = useResettableState(PAGE_SIZE, filterSignature);

  // Restore scroll on back-navigation
  useEffect(() => {
    const key = getScrollKey();
    const saved = sessionStorage.getItem(key);
    if (saved) {
      requestAnimationFrame(() => window.scrollTo(0, parseInt(saved, 10)));
      sessionStorage.removeItem(key);
    }
  }, []);

  const setPriceFromUrl = (min: string, max: string) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (min) p.set("priceMin", min); else p.delete("priceMin");
      if (max) p.set("priceMax", max); else p.delete("priceMax");
      return p;
    });
    setLocalPriceMin(min);
    setLocalPriceMax(max);
  };

  const setSortBy = (v: string) =>
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (v && v !== "popular") p.set("sort", v);
      else p.delete("sort");
      return p;
    });

  const setCategory = (next: string) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (next) params.set("cat", next);
      else params.delete("cat");
      return params;
    });
  };

  const searchEnabled = !!(query || selectedBrand);
  // Spring Pageable is 0-based; currentPage is 1-based.
  const search = useSearch(
    {
      q: query || undefined,
      category: selectedCat || undefined,
      brand: selectedBrand || undefined,
      minPrice: priceMin ? Number(priceMin) * 1000 : undefined,
      maxPrice: priceMax ? Number(priceMax) * 1000 : undefined,
      sort: sortBy === "popular" ? undefined : sortBy,
      page: currentPage - 1,
      size: pageSize,
      sameDay: sameDay || undefined,
      verifiedOnly: verifiedOnly || undefined,
      officialOnly: officialOnly || undefined,
    },
    searchEnabled,
  );

  const { facets } = useSearchFacets({
    q: query || undefined,
    category: selectedCat || undefined,
    brand: selectedBrand || undefined,
    minPrice: priceMin ? Number(priceMin) * 1000 : undefined,
    maxPrice: priceMax ? Number(priceMax) * 1000 : undefined,
    sameDay: sameDay || undefined,
    verifiedOnly: verifiedOnly || undefined,
    officialOnly: officialOnly || undefined,
    enabled: searchEnabled,
  });

  const { data: localCatalog = [] } = useProducts({ categoryId: selectedCat || undefined });
  const { data: categories = [] } = useCategories();

  const usedBackend = searchEnabled && !search.error;
  const catalog = usedBackend ? search.products : localCatalog;

  const filtered = useMemo(() => {
    let list = [...catalog];
    if (isFlash) list = list.filter((p) => (p.discount ?? 0) >= 20 || p.badge === "flash");
    if (!usedBackend) {
      if (selectedCat) list = list.filter((p) => p.category === selectedCat);
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
    if (priceMin) list = list.filter((p) => p.price >= Number(priceMin) * 1000);
    if (priceMax) list = list.filter((p) => p.price <= Number(priceMax) * 1000);
    if (minRating > 0) list = list.filter((p) => p.rating >= minRating);
    if (freeShipOnly) list = list.filter((p) => p.shippingFee === 0);
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
      case "rating":
        list.sort((a, b) => b.rating - a.rating);
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
    usedBackend,
    query,
    selectedCat,
    priceMin,
    priceMax,
    minRating,
    freeShipOnly,
    sameDay,
    verifiedOnly,
    officialOnly,
    sortBy,
    isFlash,
  ]);

  // Backend handles its own pagination; only slice locally for the fallback catalog.
  const totalCount = usedBackend ? search.totalElements : filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const paginated = usedBackend
    ? filtered
    : filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const clearFilters = () => {
    setMinRating(0);
    setFreeShipOnly(false);
    setSameDay(false);
    setVerifiedOnly(false);
    setOfficialOnly(false);
    setSelectedBrand("");
    setLocalPriceMin("");
    setLocalPriceMax("");
    setSearchParams((prev) => {
      const p = new URLSearchParams();
      const q = prev.get("q");
      if (q) p.set("q", q);
      const flash = prev.get("flash");
      if (flash) p.set("flash", flash);
      return p;
    });
  };

  const activeFilters: { label: string; onRemove: () => void }[] = [];
  if (selectedCat) {
    const cat = categories.find((c) => c.id === selectedCat);
    activeFilters.push({
      label: cat ? categoryDisplayLabel(cat) : selectedCat,
      onRemove: () => setCategory(""),
    });
  }
  if (selectedBrand) {
    activeFilters.push({ label: selectedBrand, onRemove: () => setSelectedBrand("") });
  }
  if (priceMin || priceMax) {
    activeFilters.push({
      label: `${priceMin ? `${priceMin}k` : "0"} – ${priceMax ? `${priceMax}k` : "∞"}`,
      onRemove: () => setPriceFromUrl("", ""),
    });
  }
  if (minRating > 0) {
    activeFilters.push({
      label: t("search.ratingAtLeast", { r: minRating }),
      onRemove: () => setMinRating(0),
    });
  }
  if (freeShipOnly) {
    activeFilters.push({ label: t("search.freeShipping"), onRemove: () => setFreeShipOnly(false) });
  }

  const sortOptions = [
    { v: "popular", l: t("search.sort.shortPopular") },
    { v: "rating", l: t("search.sort.shortRating") },
    { v: "price-low", l: t("search.sort.shortPriceLow") },
    { v: "price-high", l: t("search.sort.shortPriceHigh") },
    { v: "newest", l: t("search.sort.shortNewest") },
  ];

  // Pagination helper: build page numbers with ellipsis
  const getPageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [];
    pages.push(1);
    if (currentPage > 3) pages.push("...");
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
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
        {query ? t("search.resultsForQuery", { query, defaultValue: `Search results for "${query}"` }) : t("search.allProducts", { defaultValue: "All Products" })}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">

        {/* ── Filter Sidebar ── */}
        <aside>
          <div className="bg-card border border-border rounded-[var(--radius-xl)] p-5 lg:sticky lg:top-[80px] h-fit">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={16} className="text-foreground" />
                <span className="font-semibold text-foreground">{t("search.filtersTitle")}</span>
              </div>
              {activeFilters.length > 0 ? (
                <button
                  onClick={clearFilters}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {t("search.clearAll")}
                </button>
              ) : null}
            </div>

            {/* Category */}
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                {t("search.categoriesTitle")}
              </p>
              <div className="space-y-1.5">
                {categories.map((cat) => {
                  const checked = selectedCat === cat.id;
                  return (
                    <label key={cat.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setCategory(checked ? "" : cat.id)}
                        className="w-4 h-4 rounded border-border accent-primary"
                      />
                      <span className="text-sm text-foreground">{categoryDisplayLabel(cat)}</span>
                    </label>
                  );
                })}
                {/* BE-driven category facets */}
                {facets.categories.length > 0 ? (
                  <FacetList
                    title=""
                    entries={facets.categories}
                    selected={selectedCat}
                    onToggle={(key) => setCategory(selectedCat === key ? "" : key)}
                    formatLabel={(key) => {
                      const cat = categories.find((c) => c.id === key);
                      return cat ? categoryDisplayLabel(cat) : key;
                    }}
                  />
                ) : null}
              </div>
            </div>

            {/* Price Range */}
            <div className="mb-5 pt-4 border-t border-border">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                {t("search.priceHeader")}
              </p>
              <div className="flex gap-2 mb-2">
                <input
                  value={localPriceMin}
                  onChange={(e) => setLocalPriceMin(e.target.value)}
                  placeholder={t("search.priceFrom")}
                  type="number"
                  className="flex-1 min-w-0 px-3 py-2 border border-border rounded-[var(--radius-sm)] text-xs outline-none focus:border-primary bg-background"
                />
                <span className="text-xs text-muted-foreground self-center">—</span>
                <input
                  value={localPriceMax}
                  onChange={(e) => setLocalPriceMax(e.target.value)}
                  placeholder={t("search.priceTo")}
                  type="number"
                  className="flex-1 min-w-0 px-3 py-2 border border-border rounded-[var(--radius-sm)] text-xs outline-none focus:border-primary bg-background"
                />
              </div>
              <button
                onClick={() => setPriceFromUrl(localPriceMin, localPriceMax)}
                className="w-full py-1.5 rounded-[var(--radius-lg)] border border-border text-xs font-medium text-foreground hover:border-primary hover:text-primary transition-colors"
              >
                {t("search.priceApply", { defaultValue: "Apply Price" })}
              </button>
            </div>

            {/* Rating */}
            <div className="mb-5 pt-4 border-t border-border">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                {t("search.ratingHeader")}
              </p>
              <div className="space-y-1.5">
                {[5, 4, 3].map((r) => {
                  const checked = minRating === r;
                  return (
                    <label key={r} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setMinRating(checked ? 0 : r)}
                        className="w-4 h-4 rounded border-border accent-primary"
                      />
                      <span className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i} // eslint-disable-line react/no-array-index-key
                            size={12}
                            fill={i < r ? "var(--rating)" : "transparent"}
                            className={i < r ? "text-amber-400" : "text-muted-foreground"}
                          />
                        ))}
                        <span className="text-xs text-foreground ml-0.5">{t("search.andUp", { defaultValue: "& up" })}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Shipping */}
            <div className="mb-5 pt-4 border-t border-border">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                {t("search.shippingHeader", { defaultValue: "Shipping" })}
              </p>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={freeShipOnly}
                    onChange={() => setFreeShipOnly(!freeShipOnly)}
                    className="w-4 h-4 rounded border-border accent-primary"
                  />
                  <span className="text-sm text-foreground">{t("search.freeShippingTag", { defaultValue: "Free shipping" })}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sameDay}
                    onChange={() => setSameDay(!sameDay)}
                    className="w-4 h-4 rounded border-border accent-primary"
                  />
                  <span className="text-sm text-foreground">{t("search.sameDayDelivery", { defaultValue: "Same-day delivery" })}</span>
                </label>
              </div>
            </div>

            {/* Seller */}
            <div className="mb-5 pt-4 border-t border-border">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                {t("search.brandsTitle")}
              </p>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={verifiedOnly}
                    onChange={() => setVerifiedOnly(!verifiedOnly)}
                    className="w-4 h-4 rounded border-border accent-primary"
                  />
                  <span className="text-sm text-foreground">{t("search.verifiedOnly", { defaultValue: "Verified only" })}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={officialOnly}
                    onChange={() => setOfficialOnly(!officialOnly)}
                    className="w-4 h-4 rounded border-border accent-primary"
                  />
                  <span className="text-sm text-foreground">{t("search.officialStores", { defaultValue: "Official stores" })}</span>
                </label>
              </div>

              {/* BE-driven brand facets */}
              <FacetList
                title=""
                entries={facets.brands}
                selected={selectedBrand}
                onToggle={(key) => setSelectedBrand(selectedBrand === key ? "" : key)}
              />
            </div>
          </div>
        </aside>

        {/* ── Results Area ── */}
        <div className="min-w-0">
          {/* Active filter pills */}
          {activeFilters.length > 0 ? (
            <div className="flex flex-wrap gap-2 mb-4">
              {activeFilters.map((f) => (
                <button
                  key={f.label}
                  onClick={f.onRemove}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-light text-primary text-xs font-medium rounded-full border border-primary/15 cursor-pointer hover:bg-error/10 hover:text-error hover:border-error/20 transition-colors"
                >
                  {f.label}
                  <X size={12} />
                </button>
              ))}
            </div>
          ) : null}

          {/* Search toolbar */}
          <div className="flex items-center justify-between p-3 px-4 bg-card border border-border rounded-[var(--radius-lg)] mb-4">
            <p aria-live="polite" aria-atomic="true" className="text-sm text-text-secondary">
              {query ? (
                totalCount === 0 ? (
                  <span>{t("search.noResultsFor", { query, defaultValue: "No results for '{{query}}'" })}</span>
                ) : (
                  <span>
                    {t("search.showingRange", {
                      start: (currentPage - 1) * pageSize + 1,
                      end: Math.min(currentPage * pageSize, filtered.length),
                      total: totalCount,
                      query,
                      defaultValue: "Showing {{start}}–{{end}} of {{total}} results for '{{query}}'",
                    })}
                  </span>
                )
              ) : (
                <>
                  <span className="font-medium text-foreground">{totalCount}</span>{" "}
                  {t("search.allProducts")}
                </>
              )}
            </p>

            {/* Sort pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {sortOptions.map((opt) => {
                const active = sortBy === opt.v;
                return (
                  <button
                    key={opt.v}
                    onClick={() => setSortBy(opt.v)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      active
                        ? "bg-primary text-white border-primary shadow-[0_2px_8px_oklch(from_var(--primary)_l_c_h_/_0.25)]"
                        : "border-border text-text-secondary hover:border-primary hover:text-primary"
                    }`}
                  >
                    {opt.l}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product grid / empty state */}
          {paginated.length === 0 ? (
            <div className="py-24 text-center bg-card border border-border rounded-[var(--radius-xl)]">
              <Search size={48} className="mx-auto mb-4 text-muted-foreground opacity-30" />
              <h3 className="text-lg font-semibold text-foreground mb-2">{t("search.emptyTitle")}</h3>
              <p className="text-sm text-muted-foreground mb-6">{t("search.emptySub")}</p>
              <button
                onClick={clearFilters}
                className="px-6 py-2.5 rounded-[var(--radius-lg)] bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                {t("search.emptyClear")}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
              {paginated.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 ? (
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
                    …
                  </span>
                ) : (
                  <button
                    key={page}
                    onClick={() => { if (typeof page === "number") setCurrentPage(page); }}
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
