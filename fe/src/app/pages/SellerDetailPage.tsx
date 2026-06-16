import { IconStar, IconPackage } from "@tabler/icons-react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router";

import { ImageWithFallback } from "../components/image-with-fallback";
import { sellerDetailOptions, sellerProductsOptions } from "../hooks/use-sellers";
import { formatPrice } from "../lib/format";
import type { ProductSummary } from "../types/api";

function SellerProductCard({ product }: { product: ProductSummary }) {
  const navigate = useNavigate();

  const image =
    typeof product.images?.[0] === "string"
      ? product.images[0]
      : (product.images?.[0] as { url?: string } | undefined)?.url ?? product.image ?? "";

  return (
    <div
      role="button"
      tabIndex={0}
      className="group rounded-2xl overflow-hidden cursor-pointer bg-card border border-border hover:border-transparent hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.15)] hover:-translate-y-1 transition-all duration-300"
      onClick={() => void navigate(`/product/${product.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          void navigate(`/product/${product.id}`);
        }
      }}
    >
      <div className="relative overflow-hidden" style={{ aspectRatio: "1" }}>
        <ImageWithFallback
          src={image}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </div>
      <div className="p-3">
        <h3 className="text-sm font-medium text-foreground leading-snug line-clamp-2 mb-2 min-h-[2.5rem]">
          {product.name}
        </h3>
        <div className="flex items-baseline gap-2">
          <span className="font-bold text-sm" style={{ color: "#FF6200" }}>
            {product.price !== undefined ? formatPrice(product.price) : "—"}
          </span>
          {product.originalPrice ? (
            <span className="text-xs text-muted-foreground line-through">
              {formatPrice(product.originalPrice)}
            </span>
          ) : null}
        </div>
        {product.rating !== undefined ? (
          <div className="flex items-center gap-1 mt-1.5">
            <IconStar size={11} fill="#FF6200" color="#FF6200" />
            <span className="text-xs font-semibold text-foreground">{product.rating}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function SellerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();

  const { data: seller } = useSuspenseQuery(sellerDetailOptions(id));
  const { data: productsData } = useSuspenseQuery(sellerProductsOptions(id));

  const initial = seller.shopName.charAt(0).toUpperCase();

  const joinedDate = (() => {
    try {
      return new Date(seller.joinedAt).toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      });
    } catch {
      return seller.joinedAt;
    }
  })();

  const products = productsData?.content ?? [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Banner */}
      <div
        className="h-48 md:h-64 rounded-3xl overflow-hidden"
        style={
          seller.bannerUrl
            ? undefined
            : { background: "linear-gradient(135deg, #006B65 0%, #009990 50%, var(--primary) 100%)" }
        }
      >
        {seller.bannerUrl ? (
          <img
            src={seller.bannerUrl}
            alt={seller.shopName}
            className="w-full h-full object-cover"
          />
        ) : null}
      </div>

      {/* Header card overlapping banner */}
      <div className="relative -mt-12 bg-card rounded-3xl shadow-sm px-6 pt-4 pb-6 mx-2">
        <div className="flex items-end gap-4">
          {/* Logo */}
          <div className="w-24 h-24 rounded-2xl border-4 border-white shadow-md overflow-hidden shrink-0 bg-muted flex items-center justify-center -mt-8">
            {seller.logoUrl ? (
              <img src={seller.logoUrl} alt={seller.shopName} className="w-full h-full object-cover" />
            ) : (
              <span
                className="text-3xl font-black text-white"
                style={{ background: "var(--primary)", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                {initial}
              </span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 pb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1
                className="text-xl font-bold text-foreground truncate"
                style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
              >
                {seller.shopName}
              </h1>
              <span
                className="px-2 py-0.5 rounded-full text-xs font-semibold text-white shrink-0"
                style={{ background: seller.tier === "PREMIUM" ? "#F59E0B" : "var(--primary)" }}
              >
                {seller.tier}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1.5 flex-wrap text-sm text-muted-foreground">
              {seller.ratingAvg !== null && seller.ratingAvg !== undefined ? (
                <span className="flex items-center gap-1">
                  <IconStar size={13} fill="#FF6200" color="#FF6200" />
                  <span className="font-semibold text-foreground">{seller.ratingAvg.toFixed(1)}</span>
                  <span>({t("sellerDetail.ratingsLabel", { count: seller.ratingCount })})</span>
                </span>
              ) : null}
              <span className="flex items-center gap-1">
                <IconPackage size={13} />
                {t("sellerDetail.productCount", { count: seller.totalProducts })}
              </span>
              <span>{t("sellerDetail.joined", { date: joinedDate })}</span>
            </div>
          </div>
        </div>

        {/* Description */}
        {seller.description ? (
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed">{seller.description}</p>
        ) : null}
      </div>

      {/* Products */}
      <div className="mt-8">
        <h2
          className="text-xl font-bold text-foreground mb-5"
          style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
        >
          {t("sellerDetail.products")}
        </h2>

        {products.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <IconPackage size={48} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm">{t("sellerDetail.noProducts")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {products.map((product) => (
              <SellerProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
