import {
  IconChevronLeft,
  IconChevronRight,
  IconEdit,
  IconPlus,
  IconSearch,
} from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { SellerProductModal } from "../../components/seller-product-modal";
import { useAuth } from "../../hooks/use-auth";
import { useDebouncedValue } from "../../hooks/use-debounced-value";
import { useProducts } from "../../hooks/use-products";
import { formatPrice } from "../../lib/format";
import { type Product } from "../../types/ui";

const PAGE_SIZE = 24;

export function SellerProducts() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [page, setPage] = useState(0);
  const { subject: sellerId } = useAuth();
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const { data: catalog = [], isLoading } = useProducts({
    sellerId,
    q: debouncedSearch || undefined,
    page,
    size: PAGE_SIZE,
  });
  const { t } = useTranslation();
  const hasMore = catalog.length === PAGE_SIZE;

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  return (
    <div className="space-y-5">
      <SellerProductModal open={showCreate} onClose={() => setShowCreate(false)} />
      <SellerProductModal open={!!editing} product={editing} onClose={() => setEditing(null)} />

      {/* Header row with Add Product button */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">{t("seller.products.title")}</h2>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius-md)] bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary-hover transition-colors"
        >
          <IconPlus size={16} aria-hidden="true" />
          {t("seller.products.addNew")}
        </button>
      </div>

      {/* Search row */}
      <div className="flex">
        <div className="flex-1 flex items-center gap-3 bg-card border border-border rounded-[var(--radius-md)] px-4 py-2.5">
          <IconSearch size={16} className="text-muted-foreground" aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t("seller.products.searchPlaceholder")}
            className="flex-1 text-sm outline-none bg-transparent"
            aria-label={t("seller.products.searchPlaceholder")}
          />
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("seller.products.loading")}</p>
      ) : null}

      {/* Products table */}
      <div className="bg-card border border-border rounded-[var(--radius-lg)] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {[
                t("seller.products.th.product"),
                t("seller.products.th.price"),
                t("seller.products.th.stock"),
                t("seller.products.th.sold"),
                "",
              ].map((h, i) => (
                <th
                  // eslint-disable-next-line react/no-array-index-key -- table headers are positional, no stable id
                  key={i}
                  className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-left"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {catalog.map((p) => (
              <tr key={p.id} className="hover:bg-background transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.name}
                        className="w-10 h-10 rounded-[var(--radius-md)] object-cover shrink-0"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-[var(--radius-md)] bg-muted shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    <p className="text-sm font-medium text-foreground max-w-[280px] truncate">
                      {p.name}
                    </p>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm font-bold text-primary">{formatPrice(p.price)}</td>
                <td className="px-4 py-3 text-sm text-text-secondary">{p.stock}</td>
                <td className="px-4 py-3 text-sm text-text-secondary">{p.sold.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setEditing(p)}
                    className="p-1.5 rounded-[var(--radius-md)] hover:bg-primary-light text-primary transition-colors"
                    title={t("seller.products.editTooltip")}
                    aria-label={t("seller.products.editTooltip")}
                  >
                    <IconEdit size={14} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <button
            type="button"
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-[var(--radius-md)] text-sm text-text-secondary border border-border disabled:opacity-40 hover:bg-background transition-colors"
          >
            <IconChevronLeft size={14} aria-hidden="true" />
            {t("seller.products.prev")}
          </button>
          <span className="text-xs text-muted-foreground">
            {t("seller.products.pageIndicator", { page: page + 1 })}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasMore}
            className="flex items-center gap-1 px-3 py-1.5 rounded-[var(--radius-md)] text-sm text-text-secondary border border-border disabled:opacity-40 hover:bg-background transition-colors"
          >
            {t("seller.products.next")}
            <IconChevronRight size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
