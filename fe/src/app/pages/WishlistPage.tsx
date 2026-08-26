import { useQueries } from "@tanstack/react-query";
import { Heart, ShoppingCart, Star, Trash2, Share2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { AccountNav } from "@/features/account";
import { ApiError } from "@/shared/api";
import { formatPrice } from "@/shared/lib";
import { ImageWithFallback } from "@/shared/ui";

import { useAuth } from "../hooks/auth-context";
import { useCart } from "../hooks/use-cart";
import { productDetailOptions } from "../hooks/use-products";
import { useWishlist } from "../hooks/use-wishlist";

export function WishlistPage() {
  const navigate = useNavigate();
  const { ready, authenticated } = useAuth();
  const wishlist = useWishlist();
  const { addItem } = useCart();
  const { t } = useTranslation();

  // useWishlist() hydrates from localStorage internally, no effect needed here.

  const queries = useQueries({
    queries: wishlist.ids.map((id) => ({
      ...productDetailOptions(id),
      retry: false,
      staleTime: 5 * 60_000,
    })),
  });

  const products = useMemo(
    () =>
      queries
        .map((q, i) => ({ id: wishlist.ids[i], data: q.data, error: q.error }))
        .filter((p) => !!p.data),
    [queries, wishlist.ids],
  );

  const handleAddToCart = (productId: string) => {
    if (!authenticated) {
      toast.info(t("wishlist.loginToAdd"));
      return;
    }
    addItem(
      { productId, quantity: 1 },
      {
        onSuccess: () => toast.success(t("wishlist.addedOne")),
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : t("wishlist.addError")),
      },
    );
  };

  const handleAddAll = () => {
    if (!authenticated) {
      toast.info(t("wishlist.loginToAdd"));
      return;
    }
    products.forEach((p) => addItem({ productId: p.id, quantity: 1 }));
    toast.success(t("wishlist.addedMany", { count: products.length }));
  };

  if (!ready) return null;

  return (
    <div className="max-w-[1100px] mx-auto py-8 px-8">
      <AccountNav />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          {t("wishlist.pageTitle")}
          {wishlist.count > 0 ? (
            <span className="ml-2 text-base font-medium text-text-secondary">
              ({t("wishlist.countLabel", { count: wishlist.count })})
            </span>
          ) : null}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => {
              void navigator.clipboard.writeText(window.location.href);
              toast.success("Link copied!");
            }}
            className="p-2.5 rounded-[var(--radius-md)] border border-border bg-card text-muted-foreground hover:bg-muted"
            aria-label="Share wishlist"
          >
            <Share2 size={18} />
          </button>
        </div>
      </div>

      {wishlist.count === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="py-24 text-center bg-card rounded-[var(--radius-lg)] border border-border"
        >
          <Heart size={64} className="mx-auto mb-5 text-gray-200" />
          <h2 className="text-xl font-bold text-muted-foreground mb-3">
            {t("wishlist.emptyTitle")}
          </h2>
          <p className="text-sm text-muted-foreground mb-8 max-w-xs mx-auto">
            {t("wishlist.emptySub")}
          </p>
          <button
            onClick={() => navigate("/")}
            className="px-8 py-3 rounded-[var(--radius-lg)] bg-primary text-white font-semibold hover:opacity-90 transition-opacity"
          >
            {t("wishlist.discover")}
          </button>
        </motion.div>
      ) : (
        <>
          <div className="flex gap-3 mb-6">
            <button
              onClick={handleAddAll}
              disabled={products.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius-md)] bg-primary text-white font-semibold text-sm disabled:opacity-50"
            >
              <ShoppingCart size={16} /> {t("wishlist.addAll")}
            </button>
            <button
              onClick={() => {
                wishlist.clear();
                toast.info(t("wishlist.cleared"));
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius-md)] font-semibold text-sm border border-border bg-card text-muted-foreground hover:border-red-300 hover:text-red-500 transition-colors"
            >
              <Trash2 size={16} /> {t("wishlist.clearAll")}
            </button>
          </div>

          <AnimatePresence>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {products.map(({ id, data: p }, i) => {
                if (!p) return null;
                const original = p.originalPrice;
                const discount =
                  original && p.price && original > p.price
                    ? Math.round(((original - p.price) / original) * 100)
                    : null;
                return (
                  <motion.div
                    key={id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-card rounded-[var(--radius-lg)] border border-border overflow-hidden hover:shadow-lg transition-all group"
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label={t("wishlist.viewAria", { name: p.name })}
                      className="relative overflow-hidden cursor-pointer bg-muted"
                      style={{ aspectRatio: "1" }}
                      onClick={() => navigate(`/product/${id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          void navigate(`/product/${id}`);
                        }
                      }}
                    >
                      <ImageWithFallback
                        src={p.image ?? ""}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        imagePreset="card"
                        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                      />
                      {discount !== null ? (
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold">
                          -{discount}%
                        </span>
                      ) : null}
                      {/* Heart always visible and red (active state) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          wishlist.toggle(id);
                          toast.info(t("wishlist.removed"));
                        }}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-md bg-card opacity-100"
                        aria-label={t("wishlist.removeAria", { name: p.name })}
                      >
                        <Heart size={14} fill="var(--error)" className="text-red-500" />
                      </button>
                    </div>
                    <div className="p-3">
                      <button
                        onClick={() => navigate(`/product/${id}`)}
                        className="text-sm font-medium text-foreground line-clamp-2 text-left hover:underline"
                      >
                        {p.name}
                      </button>
                      {p.rating !== undefined || p.reviewCount !== undefined ? (
                        <div className="flex items-center gap-1 mt-1 mb-2">
                          <Star size={11} fill="var(--rating)" className="text-amber-400" />
                          <span className="text-xs text-muted-foreground">{p.rating ?? 0}</span>
                          <span className="text-xs text-muted-foreground">
                            ({(p.reviewCount ?? 0).toLocaleString()})
                          </span>
                        </div>
                      ) : null}
                      <div className="flex items-center gap-1 mb-3">
                        <span className="font-bold text-sm text-primary">
                          {formatPrice(p.price ?? 0)}
                        </span>
                        {original ? (
                          <span className="text-xs text-muted-foreground line-through">
                            {formatPrice(original)}
                          </span>
                        ) : null}
                      </div>
                      <button
                        onClick={() => handleAddToCart(id)}
                        className="w-full py-2 rounded-[var(--radius-md)] bg-primary text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity"
                      >
                        <ShoppingCart size={13} /> {t("wishlist.addToCart")}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </AnimatePresence>

          {queries.some((q) => q.isLoading) ? (
            <p className="text-xs text-muted-foreground text-center mt-6">
              {t("wishlist.loadingItems")}
            </p>
          ) : null}
          {queries.some((q) => q.error instanceof ApiError && q.error.status === 404) ? (
            <p className="text-xs text-amber-600 text-center mt-6">{t("wishlist.stalePrompt")}</p>
          ) : null}
        </>
      )}
    </div>
  );
}
