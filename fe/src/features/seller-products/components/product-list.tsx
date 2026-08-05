/**
 * Seller product list view.
 *
 * URL-owned state: ?q=<text>&page=<one-based>&selected=<product-id>&mode=create|edit
 * Debounce only the query REQUEST; commit search to URL on submit.
 *
 * Management rows come from the authenticated seller endpoint, so drafts and
 * published products share one owner-scoped list and detail flow.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { DataTable, ImageWithFallback, type DataTableColumn } from "@/shared/ui";

import { productListOptions } from "../api/query-options";
import type { ProductListRow } from "../model/product-list-view";
import { toProductListRow } from "../model/product-list-view";

import { ProductEditorDrawer } from "./product-editor-drawer";

export interface SellerProductsRouteState {
  q: string;
  page: number;
  selected: string | null;
  mode: "create" | "edit" | null;
}

export interface ProductListProps {
  rows: readonly ProductListRow[];
  routeState: SellerProductsRouteState;
  onRouteChange: (next: SellerProductsRouteState) => void;
}

function renderProductCell(row: ProductListRow) {
  return (
    <div className="flex items-center gap-3">
      {row.image ? (
        <ImageWithFallback
          src={row.image}
          alt={row.name}
          className="h-10 w-10 shrink-0 rounded-[var(--radius-md)] object-cover"
        />
      ) : (
        <div
          className="h-10 w-10 shrink-0 rounded-[var(--radius-md)] bg-muted"
          aria-hidden="true"
        />
      )}
      <span className="max-w-[280px] truncate text-sm font-medium text-foreground">{row.name}</span>
    </div>
  );
}

function renderPriceCell(row: ProductListRow) {
  return <span className="text-sm font-bold text-primary">{row.priceRange}</span>;
}

function renderStockCell(row: ProductListRow) {
  return <span className="text-sm text-foreground">{row.stockTotal.toLocaleString()}</span>;
}

function renderSoldCell(row: ProductListRow) {
  return (
    <span className="text-sm text-muted-foreground">
      {row.sold != null ? row.sold.toLocaleString() : "-"}
    </span>
  );
}

function createProductActionsCell({
  routeState,
  onRouteChange,
  editLabel,
}: Pick<ProductListProps, "routeState" | "onRouteChange"> & { editLabel: string }) {
  function ProductActionsCell(row: ProductListRow) {
    return (
      <button
        type="button"
        onClick={() => onRouteChange({ ...routeState, selected: row.id, mode: "edit" })}
        className="rounded-[var(--radius-md)] p-1.5 text-primary transition-colors hover:bg-primary-light"
        title={editLabel}
        aria-label={editLabel}
      >
        <Edit3 size={14} aria-hidden="true" />
      </button>
    );
  }

  return ProductActionsCell;
}

export function ProductList({ rows, routeState, onRouteChange }: ProductListProps) {
  const { t } = useTranslation();

  const columns = useMemo<DataTableColumn<ProductListRow>[]>(
    () => [
      {
        id: "product",
        header: t("seller.products.th.product"),
        cell: renderProductCell,
        priority: "primary",
      },
      {
        id: "price",
        header: t("seller.products.th.price"),
        cell: renderPriceCell,
        priority: "secondary",
        align: "start",
      },
      {
        id: "stock",
        header: t("seller.products.th.stock"),
        cell: renderStockCell,
        priority: "secondary",
        align: "center",
      },
      {
        id: "sold",
        header: t("seller.products.th.sold"),
        cell: renderSoldCell,
        priority: "tertiary",
        align: "center",
      },
      {
        id: "actions",
        header: "",
        cell: createProductActionsCell({
          routeState,
          onRouteChange,
          editLabel: t("seller.products.editTooltip"),
        }),
        align: "end",
      },
    ],
    [onRouteChange, routeState, t],
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">{t("seller.products.title")}</h2>
        <button
          type="button"
          onClick={() => onRouteChange({ ...routeState, mode: "create", selected: null })}
          className="flex items-center gap-2 rounded-[var(--radius-md)] bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          <Plus size={16} aria-hidden="true" />
          {t("seller.products.addNew")}
        </button>
      </div>

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

const PAGE_SIZE = 24;

interface SellerProductsListRouteProps {
  sellerId?: string;
}

export function SellerProductsListRoute(_props: SellerProductsListRouteProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const page = Number(searchParams.get("page") ?? "1");
  const selected = searchParams.get("selected");
  const mode = (searchParams.get("mode") ?? null) as "create" | "edit" | null;

  const [inputValue, setInputValue] = useState(q);
  const [debouncedQ, setDebouncedQ] = useState(q.trim());

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(inputValue.trim()), 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  useEffect(() => {
    setInputValue(q);
  }, [q]);

  const routeState: SellerProductsRouteState = { q, page, selected, mode };

  const { data: productPage, isLoading } = useQuery(
    productListOptions({
      q: debouncedQ || undefined,
      page: Math.max(0, page - 1),
      size: PAGE_SIZE,
    }),
  );

  const products = productPage?.content ?? [];
  const rows: readonly ProductListRow[] = products.map(toProductListRow);
  const totalPages =
    productPage?.totalPages ??
    (productPage?.totalElements != null
      ? Math.max(1, Math.ceil(productPage.totalElements / (productPage.size ?? PAGE_SIZE)))
      : undefined);
  const hasMore =
    productPage?.last !== undefined ? !productPage.last : products.length === PAGE_SIZE;
  const pageIndicator =
    totalPages != null
      ? t("seller.products.pageIndicator", { current: page, total: totalPages })
      : t("seller.products.pageIndicatorCurrent", { current: page });

  const handleRouteChange = (next: SellerProductsRouteState) => {
    const params = new URLSearchParams(searchParams);
    if (next.q !== q) {
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

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous);
        params.set("q", inputValue.trim());
        params.set("page", "1");
        return params;
      },
      { replace: true },
    );
  };

  const handleEditorClose = () => {
    handleRouteChange({ ...routeState, selected: null, mode: null });
  };

  const handleEditorSave = async () => {
    await queryClient.invalidateQueries({ queryKey: ["seller", "products"] });
  };

  return (
    <div className="space-y-5">
      <form onSubmit={handleSearchSubmit} className="flex">
        <div className="flex flex-1 items-center gap-3 rounded-[var(--radius-md)] border border-border bg-card px-4 py-2.5">
          <Search size={16} className="text-muted-foreground" aria-hidden="true" />
          <input
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder={t("seller.products.searchPlaceholder")}
            className="flex-1 bg-transparent text-sm outline-none"
            aria-label={t("seller.products.searchPlaceholder")}
          />
        </div>
      </form>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("seller.products.loading")}</p>
      ) : null}

      <ProductList rows={rows} routeState={routeState} onRouteChange={handleRouteChange} />

      <ProductEditorDrawer
        open={mode !== null}
        product={mode === "edit" && selected ? { id: selected } : null}
        onClose={handleEditorClose}
        onSave={handleEditorSave}
      />

      {rows.length > 0 ? (
        <nav
          aria-label={t("seller.products.paginationLabel")}
          className="flex items-center justify-center gap-2"
        >
          <button
            type="button"
            onClick={() =>
              setSearchParams(
                (params) => {
                  const next = new URLSearchParams(params);
                  next.set("page", String(page - 1));
                  return next;
                },
                { replace: true },
              )
            }
            disabled={page <= 1}
            className="rounded-[var(--radius-md)] border border-border px-3 py-1.5 text-sm transition-colors hover:bg-background disabled:opacity-40"
          >
            {t("seller.products.prev")}
          </button>
          <span className="text-xs text-muted-foreground">{pageIndicator}</span>
          <button
            type="button"
            onClick={() =>
              setSearchParams(
                (params) => {
                  const next = new URLSearchParams(params);
                  next.set("page", String(page + 1));
                  return next;
                },
                { replace: true },
              )
            }
            disabled={!hasMore}
            className="rounded-[var(--radius-md)] border border-border px-3 py-1.5 text-sm transition-colors hover:bg-background disabled:opacity-40"
          >
            {t("seller.products.next")}
          </button>
        </nav>
      ) : null}
    </div>
  );
}
