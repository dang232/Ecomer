import {
  ChevronRight,
  Zap,
  Truck,
  ShieldCheck,
  BadgeCheck,
  Lock,
  ArrowRight,
  Sparkles,
  Smartphone,
  Shirt,
  Sofa,
  Code,
  Dumbbell,
} from "lucide-react";
import { motion } from "motion/react";
import { useMemo, memo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { ImageWithFallback } from "../components/image-with-fallback";
import { ProductCard } from "../components/product-card";
import { RecentlyViewedGrid } from "../components/RecentlyViewedGrid";
import { categoryDisplayLabel, useCategories } from "../hooks/use-categories";
import { useCountdown } from "../hooks/use-countdown";
import { useFlashSaleWithProducts } from "../hooks/use-flash-sale";
import { useProducts } from "../hooks/use-products";
import { useRecentlyViewed } from "../hooks/use-recently-viewed";
import { useSellerShowcase } from "../hooks/use-sellers";
import { formatPrice } from "../lib/format";
import { cdnUrl } from "../lib/image-url";
import type { Product } from "../types/ui";

// â”€â”€â”€ Section Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SectionHeader = memo(function SectionHeader({
  title,
  ctaLabel,
  ctaPath,
}: {
  title: string;
  ctaLabel?: string;
  ctaPath?: string;
}) {
  const { t } = useTranslation();
  const cta = ctaLabel ?? t("home.viewAll", { defaultValue: "See All" });
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xl font-bold text-foreground tracking-tight">{title}</h2>
      {ctaPath ? (
        <Link
          to={ctaPath}
          className="group flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {cta}
          <ChevronRight
            className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform"
            aria-hidden="true"
          />
        </Link>
      ) : null}
    </div>
  );
});

// â”€â”€â”€ Product Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ProductCardSkeleton() {
  return (
    <div className="rounded-[var(--radius-lg)] overflow-hidden bg-card border border-border">
      <div className="aspect-square skeleton" />
      <div className="p-3 space-y-2">
        <div className="h-4 skeleton w-full" />
        <div className="h-4 skeleton w-3/4" />
        <div className="h-4 skeleton w-1/2" />
      </div>
    </div>
  );
}

// â”€â”€â”€ Hero Section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function HeroSection() {
  const { t } = useTranslation();

  return (
    <section className="mx-[var(--content-padding)] mt-6 bg-gradient-to-br from-primary to-[oklch(50%_0.22_295)] rounded-[var(--radius-2xl)] relative overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute -top-[60%] -right-[15%] w-[500px] h-[500px] rounded-full bg-white/[0.04] animate-pulse" />
      <div className="absolute -bottom-[40%] left-[20%] w-[300px] h-[300px] rounded-full bg-white/[0.03] animate-pulse" />

      <div className="relative z-10 max-w-[480px]" style={{ padding: "clamp(32px, 5vw, 56px)" }}>
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium text-white bg-white/[0.12] border border-white/10 backdrop-blur-sm mb-4">
          <Zap className="w-3.5 h-3.5" aria-hidden="true" />
          {t("home.hero.eyebrow", { defaultValue: "Limited Time" })}
        </div>
        <h1 className="text-[var(--text-4xl)] font-extrabold text-white leading-[1.15] tracking-tight mb-3.5">
          {t("home.hero.title", { defaultValue: "Mid-Year Mega Sale" })}
          <br />
          {t("home.hero.titleLine2", { defaultValue: "Up to 70% Off" })}
        </h1>
        <p className="text-[var(--text-base)] text-white/[0.78] leading-relaxed mb-6 max-w-md">
          {t("home.hero.subtitle", {
            defaultValue:
              "Thousands of deals across all categories. Electronics, fashion, software â€” everything ships free over â‚«500,000.",
          })}
        </p>
        <Link
          to="/search"
          className="group inline-flex items-center gap-2 px-6 py-3 bg-white text-primary font-semibold text-sm rounded-[var(--radius-lg)] shadow-lg hover:-translate-y-0.5 hover:shadow-xl transition-all"
        >
          {t("home.hero.ctaShop", { defaultValue: "Shop Deals" })}
          <ArrowRight
            className="w-4 h-4 group-hover:translate-x-0.5 transition-transform"
            aria-hidden="true"
          />
        </Link>
      </div>
    </section>
  );
}

// â”€â”€â”€ Category icon map â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CATEGORY_ICONS: Record<string, React.ElementType> = {
  electronics: Smartphone,
  fashion: Shirt,
  home: Sofa,
  software: Code,
  beauty: Sparkles,
  sports: Dumbbell,
};

function getCategoryIcon(slug: string): React.ElementType {
  const key = slug.toLowerCase();
  for (const [k, Icon] of Object.entries(CATEGORY_ICONS)) {
    if (key.includes(k)) return Icon;
  }
  return Sparkles;
}

// â”€â”€â”€ Categories Grid â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function CategoriesSection() {
  const { t } = useTranslation();
  const { data: categories = [], isLoading } = useCategories();

  return (
    <section>
      <SectionHeader
        title={t("home.categories", { defaultValue: "Categories" })}
        ctaLabel={t("home.allCategoriesLabel", { defaultValue: "View All" })}
        ctaPath="/search"
      />
      {isLoading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-[var(--radius-lg)] skeleton" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
          {categories.slice(0, 6).map((cat, i) => {
            const Icon = getCategoryIcon(cat.id ?? "");
            return (
              <Link key={cat.id} to={`/search?cat=${cat.id}`} className="block">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04, duration: 0.25 }}
                  className="group flex flex-col items-center gap-2.5 py-5 px-2 bg-card border border-border rounded-[var(--radius-lg)] cursor-pointer transition-all hover:border-primary hover:bg-primary-light hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="w-12 h-12 rounded-[var(--radius-md)] bg-surface-elevated flex items-center justify-center text-text-secondary group-hover:text-primary group-hover:bg-card transition-colors">
                    <Icon className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <span className="text-xs font-medium text-foreground text-center leading-tight">
                    {categoryDisplayLabel(cat)}
                  </span>
                </motion.div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

// â”€â”€â”€ Flash Sale â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function pctOff(originalPrice: number, salePrice: number): number {
  if (originalPrice <= 0 || salePrice >= originalPrice) return 0;
  return Math.round(((originalPrice - salePrice) / originalPrice) * 100);
}

function FlashSaleSection() {
  const { items, isLoading } = useFlashSaleWithProducts();
  const { t } = useTranslation();

  const earliestEnd = useMemo(() => {
    if (items.length === 0) return null;
    const ms = items
      .map((item) => Date.parse(item.campaign.endsAt))
      .filter((n) => Number.isFinite(n));
    return ms.length > 0 ? Math.min(...ms) : null;
  }, [items]);

  const { h, m, s, isExpired } = useCountdown(earliestEnd ?? Date.now());
  const hasCampaigns = items.length > 0 && !isExpired;

  return (
    <section className="mx-[var(--content-padding)] mb-6 bg-card border border-border rounded-[var(--radius-xl)] p-6 hover:shadow-sm transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[var(--radius-md)] bg-accent-light flex items-center justify-center text-accent">
            <Zap className="w-5 h-5" aria-hidden="true" />
          </div>
          <h3 className="text-lg font-bold text-foreground">
            {t("flashSale.title", { defaultValue: "Flash Sale" })}
          </h3>
        </div>
        {hasCampaigns ? (
          <div className="flex items-center gap-1">
            {[h, m, s].map((v, i) => (
              <div key={i} className="flex items-center gap-1">
                <span className="bg-foreground text-card text-sm font-bold px-2.5 py-1.5 rounded-[var(--radius-sm)] min-w-[34px] text-center tabular-nums">
                  {v}
                </span>
                {i < 2 ? <span className="text-muted-foreground font-bold text-sm">:</span> : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Products */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : hasCampaigns ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
          {items.slice(0, 5).map(({ campaign: c }, i) => {
            // ponytail: rawDiscount from BE is authoritative; fallback to client-side calc
            const discount = c.rawDiscount ?? pctOff(c.originalPrice, c.salePrice);
            const imageSrc = cdnUrl(c.imageHash);
            const productName = c.name ?? `Product #${c.productId.slice(0, 8)}`;

            return (
              <Link key={c.id} to={`/product/${c.productId}`} className="block">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="group bg-card border border-border rounded-[var(--radius-lg)] overflow-hidden cursor-pointer hover:border-border-hover hover:shadow-lg hover:-translate-y-1 transition-all duration-[var(--duration-base)]"
                >
                  <div className="relative aspect-square bg-surface-elevated flex items-center justify-center overflow-hidden">
                    {imageSrc ? (
                      <ImageWithFallback
                        src={imageSrc}
                        alt={productName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <Zap
                        className="w-8 h-8 text-muted-foreground opacity-30"
                        aria-hidden="true"
                      />
                    )}
                    {discount > 0 ? (
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-[var(--radius-sm)] bg-error text-white text-[11px] font-semibold">
                        -{discount}%
                      </span>
                    ) : null}
                    {c.isShopOfficial ? (
                      <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-primary text-white text-[10px] font-semibold">
                        Official
                      </span>
                    ) : null}
                  </div>
                  <div className="p-3">
                    {c.shopName ? (
                      <p className="text-[11px] text-muted-foreground mb-0.5 truncate">
                        {c.shopName}
                      </p>
                    ) : null}
                    <p className="text-sm font-medium text-foreground line-clamp-2 mb-1.5 min-h-[2.5rem]">
                      {productName}
                    </p>
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-[var(--text-base)] font-bold text-primary">
                        {formatPrice(c.salePrice)}
                      </span>
                      {c.originalPrice > c.salePrice ? (
                        <span className="text-xs text-muted-foreground line-through">
                          {formatPrice(c.originalPrice)}
                        </span>
                      ) : null}
                      {c.discount ? (
                        <span className="text-[11px] font-semibold text-error bg-error-light px-1.5 py-0.5 rounded">
                          {c.discount}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </motion.div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="py-8 text-center">
          <p className="text-base font-semibold text-foreground">
            {t("flashSale.emptyTitle", { defaultValue: "No flash sale running right now" })}
          </p>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            {t("flashSale.emptyBody", {
              defaultValue: "Flash sales drop weekly. Browse the catalog while you wait.",
            })}
          </p>
        </div>
      )}
    </section>
  );
}

// â”€â”€â”€ Trust Bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Static configuration outside component to avoid recreation on every render
const TRUST_ITEMS_CONFIG = [
  { icon: Truck, titleKey: "trust.freeShipping", subKey: "trust.freeShippingSub" },
  { icon: ShieldCheck, titleKey: "trust.authentic", subKey: "trust.authenticSub" },
  { icon: BadgeCheck, titleKey: "trust.returns", subKey: "trust.returnsSub" },
  { icon: Lock, titleKey: "trust.support247", subKey: "trust.support247Sub" },
] as const;

function TrustBar() {
  const { t } = useTranslation();

  const trustItems = useMemo(
    () =>
      TRUST_ITEMS_CONFIG.map((item) => ({
        icon: item.icon,
        title: t(item.titleKey, { defaultValue: item.titleKey }),
        sub: t(item.subKey, { defaultValue: item.subKey }),
      })),
    [t],
  );

  return (
    <div className="mx-[var(--content-padding)] my-6 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
      {trustItems.map((item) => (
        <div
          key={item.title}
          className="flex items-center gap-3 p-4 bg-card border border-border rounded-[var(--radius-lg)] transition-all hover:border-primary hover:-translate-y-0.5 hover:shadow-sm"
        >
          <div className="w-11 h-11 rounded-[var(--radius-md)] bg-primary-light flex items-center justify-center text-primary shrink-0">
            <item.icon className="w-[22px] h-[22px]" aria-hidden="true" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
            <p className="text-xs text-text-secondary mt-0.5">{item.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// â”€â”€â”€ Products Section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ProductsSection() {
  const { t } = useTranslation();
  const {
    data: catalog = [] as Product[],
    isLoading: productsLoading,
    isError: productsError,
  } = useProducts();

  return (
    <section>
      <SectionHeader
        title={t("home.trending", { defaultValue: "Trending" })}
        ctaLabel={t("home.viewAll", { defaultValue: "See All" })}
        ctaPath="/search"
      />

      {productsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : productsError ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm font-semibold text-foreground">
            {t("home.productsError.title", { defaultValue: "Could not load products" })}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("home.productsError.body", { defaultValue: "Please try refreshing the page" })}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
          {catalog.slice(0, 10).map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
      )}
    </section>
  );
}

// â”€â”€â”€ Seller Showcase Section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SellerShowcaseSection() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useSellerShowcase();
  const sellers = data?.content ?? [];

  if (!isLoading && (isError || sellers.length === 0)) return null;

  return (
    <section>
      <SectionHeader
        title={t("home.sellerShowcase", { defaultValue: "Top Sellers" })}
        ctaLabel={t("home.viewAllSellers", { defaultValue: "View All" })}
        ctaPath="/search"
      />
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 rounded-[var(--radius-lg)] skeleton" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {sellers.map((seller) => {
            const name = seller.shopName || "S";
            return (
              <Link
                key={seller.id}
                to={`/sellers/${encodeURIComponent(seller.id)}`}
                className="block bg-card border border-border rounded-[var(--radius-lg)] p-4 text-center hover:border-primary hover:shadow-md transition-all cursor-pointer"
              >
                <div className="w-14 h-14 rounded-full bg-primary-light mx-auto mb-3 flex items-center justify-center text-primary font-bold text-lg">
                  {name.charAt(0).toUpperCase()}
                </div>
                <p className="text-sm font-semibold text-foreground line-clamp-1">{name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {seller.totalProducts} products
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

// â”€â”€â”€ Homepage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function HomePage() {
  const { t } = useTranslation();
  const { items: recentlyViewed } = useRecentlyViewed();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <HeroSection />

      {/* Flash Sale â€” full-bleed with own horizontal margins */}
      <div className="max-w-[var(--content-max)] mx-auto mt-8">
        <FlashSaleSection />
      </div>

      <div className="max-w-[var(--content-max)] mx-auto px-[var(--content-padding)] py-8 space-y-10">
        {/* Categories */}
        <CategoriesSection />

        {/* Trending */}
        <ProductsSection />

        {/* Recently Viewed - localStorage only, cross-device requires BE in future sprint */}
        {recentlyViewed.length > 0 ? (
          <RecentlyViewedGrid
            title={t("home.recentlyViewed", { defaultValue: "Recently Viewed" })}
            items={recentlyViewed}
          />
        ) : null}

        {/* Top Sellers */}
        <SellerShowcaseSection />
      </div>

      {/* Trust Bar â€” full-bleed with own horizontal margins */}
      <div className="max-w-[var(--content-max)] mx-auto">
        <TrustBar />
      </div>
    </div>
  );
}
