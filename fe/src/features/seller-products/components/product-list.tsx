/**
 * Seller product list view.
 *
 * URL-owned state: ?q=<text>&page=<one-based>&selected=<product-id>&mode=create|edit
 * Debounce only the query REQUEST; commit search to URL on submit.
 *
 * Note: The seller product catalog endpoint returns ACTIVE products only.
 * Deep-linked editing is supported for an ACTIVE row or a session-recovered draft,
 * NOT for an arbitrary unpublished product ID.
 */

import { IconEdit, IconPlus, IconSearch } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { useDebouncedValue } from "@/app/hooks/use-debounced-value";
import { useProducts } from "@/app/hooks/use-products";
import { DataTable , ImageWithFallback } from "@/shared/ui";

import type { ProductListRow } from "../model/product-list-view";
import { toProductListRow } from "../model/product-list-view";

// ── Route state ─────────────────────────────────────────────────────────────────

export interface SellerProductsRouteState {
  q: string;
  page: number;
  selected: string | null;
  mode: "create" | "edit" | null;
}

// ── Props ───────────────────────────────────────────────────────────────────────

interface ProductListProps {
  rows: readonly ProductListRow[];
  routeState: SellerProductsRouteState;
  onRouteChange: (next: SellerProductsRouteState) => void;
}

// ── Component ───────────────────────────────────────────────────────────────────

export function ProductList({ rows, routeState, onRouteChange }: ProductListProps) {
  const { t } = useTranslation();

  const columns = useMemo(() => [
    {
      id: "product",
      header: t("seller.products.th.product"),
      // eslint-disable-next-line react/no-unstable-nested-components
      cell: (row: ProductListRow) => (
        <div className="flex items-center gap-3">
          {row.image ? (
            <ImageWithFallback
              src={row.image}
              alt={row.name}
              className="w-10 h-10 rounded-[var(--radius-md)] object-cover shrink-0"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-[var(--radius-md)] bg-muted shrink-0"
              aria-hidden="true"
            />
          )}
          <span className="text-sm font-medium text-foreground max-w-[280px] truncate">
            {row.name}
          </span>
        </div>
      ),
      priority: "primary" as const,
    },
    {
      id: "price",
      header: t("seller.products.th.price"),
      // eslint-disable-next-line react/no-unstable-nested-components
      cell: (row: ProductListRow) => (
        <span className="text-sm font-bold text-primary">{row.priceRange}</span>
      ),
      priority: "secondary" as const,
      align: "start" as const,
    },
    {
      id: "stock",
      header: t("seller.products.th.stock"),
      // eslint-disable-next-line react/no-unstable-nested-components
      cell: (row: ProductListRow) => (
        <span className="text-sm text-foreground">{row.stockTotal.toLocaleString()}</span>
      ),
      priority: "secondary" as const,
      align: "center" as const,
    },
    {
      id: "sold",
      header: t("seller.products.th.sold"),
      // eslint-disable-next-line react/no-unstable-nested-components
      cell: (row: ProductListRow) => (
        <span className="text-sm text-muted-foreground">
          {row.sold != null ? row.sold.toLocaleString() : "–"}
        </span>
      ),
      priority: "tertiary" as const,
      align: "center" as const,
    },
    {
      id: "actions",
      header: "",
      // eslint-disable-next-line react/no-unstable-nested-components
      cell: (row: ProductListRow) => (
        <button
          type="button"
          onClick={() =>
            onRouteChange({ ...routeState, selected: row.id, mode: "edit" })
          }
          className="p-1.5 rounded-[var(--radius-md)] hover:bg-primary-light text-primary transition-colors"
          title={t("seller.products.editTooltip")}
          aria-label={t("seller.products.editTooltip")}
        >
          <IconEdit size={14} aria-hidden="true" />
        </button>
      ),
      align: "end" as const,
    },
  ], [t, routeState, onRouteChange]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">{t("seller.products.title")}</h2>
        <button
          type="button"
          onClick={() => onRouteChange({ ...routeState, mode: "create", selected: null })}
          className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius-md)] bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary-hover transition-colors"
        >
          <IconPlus size={16} aria-hidden="true" />
          {t("seller.products.addNew")}
        </button>
      </div>

      {/* Table */}
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(row) => row.id}
        selectedId={routeState.selected ?? undefined}
        empty={
          <div className="py-12 text-center text-sm text-muted-foreground">
            {t("seller.products.empty")}
          </div>
        }
        caption={t("seller.products.caption")}
      />
    </div>
  );
}

// ── Search wrapper with URL state ───────────────────────────────────────────────

const PAGE_SIZE = 24;

interface SellerProductsListRouteProps {
  sellerId: string;
}

/**
 * Full page component that wires URL state to the list.
 * Use this from the route file.
 *
 * Note: The catalog endpoint returns ACTIVE products only.
 */
export function SellerProductsListRoute({ sellerId }: SellerProductsListRouteProps) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const page = Number(searchParams.get("page") ?? "1");
  const selected = searchParams.get("selected");
  const mode = (searchParams.get("mode") ?? null) as "create" | "edit" | null;

  const [inputValue, setInputValue] = useState(q);

  // Debounce the query parameter for the API request only.
  const debouncedQ = useDebouncedValue(inputValue.trim(), 300);

  const routeState: SellerProductsRouteState = { q, page, selected, mode };

  const { data: products = [], isLoading } = useProducts({
    sellerId,
    q: debouncedQ || undefined,
    page: Math.max(0, page - 1),
    size: PAGE_SIZE,
  });

  const rows: readonly ProductListRow[] = products.map(toProductListRow);
  const hasMore = products.length === PAGE_SIZE;

  const handleRouteChange = (next: SellerProductsRouteState) => {
    const params = new URLSearchParams(searchParams);
    if (next.q !== q) {
      // Commit search to URL; reset page.
      params.set("q", next.q);
      params.set("page", "1");
    } else {
      params.set("page", String(next.page));
    }
    if (next.selected !== selected) {
      if (next.selected) params.set("selected", next.selected);
      else params.delete("selected");
    }
    if (next.mode !== mode) {
      if (next.mode) params.set("mode", next.mode);
      else params.delete("mode");
    }
    setSearchParams(params, { replace: true });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set("q", inputValue.trim());
        p.set("page", "1");
        return p;
      },
      { replace: true },
    );
  };

  return (
    <div className="space-y-5">
      {/* Search */}
      <form onSubmit={handleSearchSubmit} className="flex">
        <div className="flex-1 flex items-center gap-3 bg-card border border-border rounded-[var(--radius-md)] px-4 py-2.5">
          <IconSearch size={16} className="text-muted-foreground" aria-hidden="true" />
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={t("seller.products.searchPlaceholder")}
            className="flex-1 text-sm outline-none bg-transparent"
            aria-label={t("seller.products.searchPlaceholder")}
          />
        </div>
      </form>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("seller.products.loading")}</p>
      ) : null}

      <ProductList rows={rows} routeState={routeState} onRouteChange={handleRouteChange} />

      {/* Pagination */}
      {rows.length > 0 ? <nav
          aria-label={t("seller.products.paginationLabel")}
          className="flex items-center justify-center gap-2"
        >
          <button
            type="button"
            onClick={() =>
              setSearchParams((p) => { const n = new URLSearchParams(p); n.set("page", String(page - 1)); return n; }, { replace: true })
            }
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-[var(--radius-md)] text-sm border border-border disabled:opacity-40 hover:bg-background transition-colors"
          >
            {t("seller.products.prev")}
          </button>
          <span className="text-xs text-muted-foreground">
            {t("seller.products.pageIndicator", { current: page })}
          </span>
          <button
            type="button"
            onClick={() =>
              setSearchParams((p) => { const n = new URLSearchParams(p); n.set("page", String(page + 1)); return n; }, { replace: true })
            }
            disabled={!hasMore}
            className="px-3 py-1.5 rounded-[var(--radius-md)] text-sm border border-border disabled:opacity-40 hover:bg-background transition-colors"
          >
            {t("seller.products.next")}
          </button>
        </nav> : null}
    </div>
  );
}
