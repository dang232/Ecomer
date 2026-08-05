import { Package, Star, Store } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";

import type { PublicSeller } from "@/shared/contracts/api";
import {
  AsyncState,
  EmptyState,
  ImageWithFallback,
  PageContainer,
  PageHeader,
  Pagination,
} from "@/shared/ui";

import { usePublicSellers } from "../hooks/use-sellers";

const DEFAULT_PAGE = 1;

function readPage(searchParams: URLSearchParams) {
  const value = Number(searchParams.get("page"));
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_PAGE;
}

function SellerCard({ seller }: { seller: PublicSeller }) {
  const { t } = useTranslation();
  const initial = seller.shopName.charAt(0).toUpperCase();

  return (
    <Link
      to={`/sellers/${encodeURIComponent(seller.id)}`}
      className="group overflow-hidden rounded-[var(--radius-card)] border border-border bg-card transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={seller.shopName}
    >
      <div className="aspect-[16/9] overflow-hidden bg-surface-elevated">
        {seller.logoUrl ? (
          <ImageWithFallback
            src={seller.logoUrl}
            alt={seller.shopName}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-primary text-4xl font-bold text-primary-foreground">
            {initial}
          </div>
        )}
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 truncate text-base font-semibold text-foreground">
            {seller.shopName}
          </h2>
          <span className="shrink-0 rounded-full bg-surface-elevated px-2 py-1 text-xs font-semibold text-muted-foreground">
            {seller.tier}
          </span>
        </div>
        {seller.description ? (
          <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
            {seller.description}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          {seller.ratingAvg !== null && seller.ratingAvg !== undefined ? (
            <span className="inline-flex items-center gap-1">
              <Star
                className="h-4 w-4 fill-[var(--color-rating)] text-[var(--color-rating)]"
                aria-hidden="true"
              />
              {t("publicSellers.rating", {
                rating: seller.ratingAvg.toFixed(1),
                count: seller.ratingCount,
              })}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <Package className="h-4 w-4" aria-hidden="true" />
            {t("publicSellers.products", { count: seller.totalProducts })}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function PublicSellersPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const displayPage = readPage(searchParams);
  const apiPage = displayPage - 1;
  const query = usePublicSellers(apiPage);
  const sellers = query.data?.content ?? [];
  const totalPages = query.data?.totalPages ?? 0;
  const pageFromResponse = (query.data?.page ?? query.data?.number ?? apiPage) + 1;

  const setPage = (page: number) => {
    const next = new URLSearchParams(searchParams);
    if (page === DEFAULT_PAGE) next.delete("page");
    else next.set("page", String(page));
    setSearchParams(next);
  };

  const status = query.isLoading
    ? "loading"
    : query.error
      ? "error"
      : sellers.length === 0
        ? "empty"
        : "ready";

  return (
    <PageContainer className="space-y-8">
      <PageHeader title={t("publicSellers.title")} description={t("publicSellers.description")} />
      <AsyncState
        status={status}
        loading={
          <div aria-busy="true" className="py-16 text-center text-muted-foreground">
            {t("publicSellers.loading")}
          </div>
        }
        error={<p>{t("publicSellers.error")}</p>}
        empty={
          <EmptyState
            icon={<Store />}
            title={t("publicSellers.emptyTitle")}
            description={t("publicSellers.emptyDescription")}
          />
        }
        retry={{ label: t("publicSellers.retry"), onClick: () => void query.refetch() }}
      >
        <div className="space-y-8">
          <div
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            aria-label={t("publicSellers.listLabel")}
          >
            {sellers.map((seller) => (
              <SellerCard key={seller.id} seller={seller} />
            ))}
          </div>
          {totalPages > 1 ? (
            <Pagination
              page={pageFromResponse}
              pageCount={totalPages}
              disabled={query.isFetching}
              labels={{
                navigation: t("publicSellers.paginationLabel"),
                previous: t("publicSellers.previous"),
                next: t("publicSellers.next"),
                page: (page, pageCount) =>
                  t("publicSellers.page", { current: page, total: pageCount }),
              }}
              onPageChange={setPage}
            />
          ) : null}
        </div>
      </AsyncState>
    </PageContainer>
  );
}
