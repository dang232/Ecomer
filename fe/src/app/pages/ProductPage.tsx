import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ShoppingCart, Zap, Heart, Star, Truck, Shield, RefreshCw, ChevronRight, ChevronLeft, MessageCircle, ThumbsUp, Share2, Play, X, ZoomIn } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate, Navigate, Link } from "react-router";
import { toast } from "sonner";

import { useProductVideos, VideoPlayer, ReviewVideoDisplay } from "../../features/videos";
import { VideoPlayerSkeleton } from "../../features/videos/components/VideoPlayer";
import { usePageMeta } from "../../utils/meta-tags";
import { ImageWithFallback } from "../components/image-with-fallback";
import { RecentlyViewedGrid } from "../components/RecentlyViewedGrid";
import { useVNShop } from "../components/vnshop-context";
import { useAuth } from "../hooks/use-auth";
import { useProductReviews } from "../hooks/use-product-reviews";
import { productDetailOptions } from "../hooks/use-products";
import { useRecentlyViewed } from "../hooks/use-recently-viewed";
import { useFrequentlyBoughtTogether, useYouMayAlsoLike } from "../hooks/use-recommendations";
import { useSellerDetail } from "../hooks/use-sellers";
import { ApiError } from "../lib/api";
import { askQuestion, questionsByProduct } from "../lib/api/endpoints/questions";
import type { RecommendationItem } from "../lib/api/endpoints/recommendations";
import { createReview, voteReviewHelpful } from "../lib/api/endpoints/reviews";
import { formatPrice } from "../lib/format";
import { comingSoon } from "../lib/ui/coming-soon";

function StarRating({ value, max = 5, size = 16 }: { value: number; max?: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < Math.floor(value);
        const half = !filled && i < value;
        return (
          // eslint-disable-next-line react/no-array-index-key -- decorative star rating, no stable id
          <svg key={i} width={size} height={size} viewBox="0 0 24 24">
            <defs>
              <linearGradient id={`half-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="50%" stopColor="var(--rating)" />
                <stop offset="50%" stopColor="var(--border)" />
              </linearGradient>
            </defs>
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              fill={filled ? "var(--rating)" : half ? `url(#half-${i})` : "var(--border)"}
            />
          </svg>
        );
      })}
    </div>
  );
}

function SellerCard({ sellerId }: { sellerId?: string }) {
  const { t } = useTranslation();

  const sellerQuery = useSellerDetail(sellerId);

  if (!sellerId) return null;

  if (sellerQuery.isLoading) {
    return (
      <div className="mt-8 bg-card rounded-[var(--radius-xl)] p-5 border border-border animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-[var(--radius-lg)] bg-surface-elevated" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-surface-elevated rounded w-32" />
            <div className="h-3 bg-surface-elevated rounded w-24" />
          </div>
        </div>
      </div>
    );
  }

  if (sellerQuery.isError || !sellerQuery.data) {
    return (
      <div className="mt-8 bg-card rounded-[var(--radius-xl)] p-5 border border-border">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Shield size={18} className="text-muted-foreground opacity-30" />
          <span>{t("product.seller.comingSoon")}</span>
        </div>
      </div>
    );
  }

  const seller = sellerQuery.data;
  const initial = seller.shopName.charAt(0).toUpperCase();

  return (
    <div className="mt-8 bg-card rounded-[var(--radius-xl)] p-5 border border-border">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-[var(--radius-lg)] overflow-hidden bg-surface-elevated flex items-center justify-center shrink-0">
          {seller.logoUrl ? (
            <img src={seller.logoUrl} alt={seller.shopName} className="w-full h-full object-cover" />
          ) : (
            <span
              className="text-lg font-black text-white w-full h-full flex items-center justify-center"
              style={{ background: "#EE4D2D" }}
            >
              {initial}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">{seller.shopName}</p>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
            {seller.ratingAvg !== null && seller.ratingAvg !== undefined ? (
              <span className="flex items-center gap-1">
                <Star size={11} fill="#FF6200" color="#FF6200" />
                <span className="font-semibold text-foreground">{seller.ratingAvg.toFixed(1)}</span>
              </span>
            ) : null}
            <span>{t("product.seller.products", { count: seller.totalProducts })}</span>
          </div>
        </div>
        <Link
          to={`/sellers/${seller.id}`}
          className="shrink-0 px-4 py-2 rounded-[var(--radius-lg)] text-sm font-semibold border border-primary text-primary transition-all hover:bg-primary-light"
        >
          {t("sellerDetail.visitShop")}
        </Link>
      </div>
    </div>
  );
}

export function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, toggleWishlist, isWishlisted } = useVNShop();
  const { t } = useTranslation();

  // Guard: product ID is required — redirect to home if missing
  if (!id) {
    return <Navigate to="/" replace />;
  }

  const { data: product } = useSuspenseQuery(productDetailOptions(id));
  const fbtQuery = useFrequentlyBoughtTogether(id);
  const ymalQuery = useYouMayAlsoLike(id);
  const { authenticated, login } = useAuth();
  const qc = useQueryClient();

  // Track recently viewed (localStorage only - cross-device requires BE in future sprint)
  const { items: recentlyViewed, addToRecentlyViewed } = useRecentlyViewed();

  // Add this product to recently viewed on mount
  useEffect(() => {
    if (product) {
      addToRecentlyViewed(product.id, {
        name: product.name,
        image: product.images?.[0] ?? product.image ?? "",
        price: product.price,
        rating: product.rating,
      });
    }
  }, [product, addToRecentlyViewed]);

  const liveReviewsQuery = useProductReviews(id);

  const liveQuestionsQuery = useQuery({
    queryKey: ["questions", "product", id],
    queryFn: () => questionsByProduct(id),
    enabled: !!id,
    retry: false,
  });

  const submitReview = useMutation({
    mutationFn: (input: { rating: number; comment: string }) =>
      createReview({ productId: id, ...input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["catalog", "reviews", "product", id] });
      toast.success(t("product.reviews.submitOk"));
      setReviewDraft({ rating: 5, comment: "" });
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("product.reviews.submitErr")),
  });

  const voteHelpful = useMutation({
    mutationFn: (reviewId: string) => voteReviewHelpful(reviewId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["catalog", "reviews", "product", id] }),
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("product.reviews.voteErr")),
  });

  const submitQuestion = useMutation({
    mutationFn: (question: string) => askQuestion({ productId: id, question }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["questions", "product", id] });
      toast.success(t("product.qa.submitOk"));
      setQuestionDraft("");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("product.qa.submitErr")),
  });

  const [reviewDraft, setReviewDraft] = useState({ rating: 5, comment: "" });
  const [questionDraft, setQuestionDraft] = useState("");

  const [imageIdx, setImageIdx] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [selectedColor, setSelectedColor] = useState(product.colors?.[0] ?? "");
  const [selectedSize, setSelectedSize] = useState(product.sizes?.[0] ?? "");
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<"desc" | "specs" | "reviews" | "qa" | "videos">("desc");
  const loved = isWishlisted(product.id);

  usePageMeta({
    title: product.name,
    description: product.description?.slice(0, 160) ?? `${product.name} - Mua ngay tại VNShop`,
    image: product.images?.[0] ?? product.image,
  });

  const variant = {
    color: selectedColor || undefined,
    size: selectedSize || undefined,
    variantId: (() => {
      if (!product.variants?.length) return undefined;
      return (
        product.variants.find((v) => {
          const parts = (v.name ?? "").split(" / ").map((p) => p.trim());
          return (
            (!selectedColor || parts.includes(selectedColor)) &&
            (!selectedSize || parts.includes(selectedSize))
          );
        })?.sku
      );
    })(),
  };
  const selectedVariant = product.variants?.find(
    (v) => v.sku === variant.variantId,
  );
  const handleAddToCart = () => addToCart(product, quantity, variant);
  const handleBuyNow = () => {
    addToCart(product, quantity, variant);
    void navigate("/checkout");
  };

  const variantImage = selectedVariant?.imageUrl;
  const galleryImages = variantImage
    ? [variantImage, ...(product.images ?? [])]
    : (product.images ?? []);
  const displayPrice = selectedVariant?.priceAmount ?? product.price;
  const displayStock = selectedVariant?.stockQuantity ?? product.stock;
  const savings = product.originalPrice ? product.originalPrice - displayPrice : 0;

  // ── Video-first gallery with discriminated union ──
  type GalleryItem =
    | { type: "image"; url: string }
    | { type: "video"; playbackUrl: string; thumbnailUrl: string };

  const { videos: productVideos, isLoading: isProductVideosLoading, isError: isProductVideosError, refetch: refetchProductVideos } = useProductVideos(product.id);

  const galleryItems: GalleryItem[] = [
    ...productVideos.map((v) => ({
      type: "video" as const,
      playbackUrl: v.playbackUrl ?? "",
      thumbnailUrl: v.thumbnailUrl ?? "",
    })),
    ...galleryImages.map((url) => ({ type: "image" as const, url })),
  ];

  const currentItem = galleryItems[imageIdx] ?? galleryItems[0];

  return (
    <div className="max-w-[1200px] mx-auto py-8 px-[var(--content-padding)]">
      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* ── A. Left Column — Gallery ── */}
        <div className="lg:sticky lg:top-[80px] self-start space-y-3">
          {/* Main gallery area */}
          <div
            className="relative aspect-square bg-surface-elevated rounded-[var(--radius-xl)] border border-border overflow-hidden group"
            aria-label="Product media gallery"
            role="region"
            tabIndex={galleryItems.length > 1 ? 0 : undefined}
            onKeyDown={
              galleryItems.length > 1
                ? (e) => {
                    if (e.key === "Escape" && isVideoPlaying) {
                      setIsVideoPlaying(false);
                      return;
                    }
                    if (e.key === "ArrowLeft") {
                      e.preventDefault();
                      setImageIdx((i) => (i - 1 + galleryItems.length) % galleryItems.length);
                      setIsVideoPlaying(false);
                      setIsZoomed(false);
                    } else if (e.key === "ArrowRight") {
                      e.preventDefault();
                      setImageIdx((i) => (i + 1) % galleryItems.length);
                      setIsVideoPlaying(false);
                      setIsZoomed(false);
                    }
                  }
                : undefined
            }
          >
            {isVideoPlaying && currentItem?.type === "video" ? (
              <div className="relative w-full h-full flex items-center justify-center" aria-live="polite">
                <VideoPlayer
                  src={currentItem.playbackUrl}
                  poster={currentItem.thumbnailUrl}
                  className="w-full h-full object-contain"
                />
                <button
                  className="absolute top-3 right-3 min-h-[44px] min-w-[44px] p-2.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                  onClick={() => setIsVideoPlaying(false)}
                  aria-label={t("video.gallery.closePlayer")}
                >
                  <X size={18} />
                </button>
              </div>
            ) : currentItem?.type === "video" ? (
              <button
                className="relative w-full h-full"
                onClick={() => setIsVideoPlaying(true)}
                aria-label={t("video.gallery.playOverlay")}
              >
                <ImageWithFallback
                  src={currentItem.thumbnailUrl}
                  alt="Video thumbnail"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center">
                    <Play size={32} className="text-white ml-1" />
                  </div>
                </div>
              </button>
            ) : currentItem?.type === "image" ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key={imageIdx}
                  className={[
                    "w-full h-full",
                    isZoomed ? "cursor-zoom-out" : "cursor-zoom-in",
                  ].join(" ")}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0, scale: isZoomed ? 1.5 : 1 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                  onClick={() => setIsZoomed(!isZoomed)}
                >
                  <ImageWithFallback
                    src={currentItem.url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </motion.div>
              </AnimatePresence>
            ) : null}

            {galleryItems.length > 1 ? (
              <>
                <button
                  onClick={() => { setImageIdx((i) => (i - 1 + galleryItems.length) % galleryItems.length); setIsVideoPlaying(false); setIsZoomed(false); }}
                  aria-label="Previous"
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 shadow-md flex items-center justify-center hover:bg-card transition-colors"
                >
                  <ChevronLeft size={18} className="text-foreground" />
                </button>
                <button
                  onClick={() => { setImageIdx((i) => (i + 1) % galleryItems.length); setIsVideoPlaying(false); setIsZoomed(false); }}
                  aria-label="Next"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 shadow-md flex items-center justify-center hover:bg-card transition-colors"
                >
                  <ChevronRight size={18} className="text-foreground" />
                </button>
              </>
            ) : null}

            {product.badge ? (
              <span
                className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-white text-xs font-bold"
                style={{
                  background:
                    product.badge === "flash"
                      ? "#E53E3E"
                      : product.badge === "new"
                        ? "#10B981"
                        : "#FF6200",
                }}
              >
                {product.badge === "flash"
                  ? t("product.badge.flash")
                  : product.badge === "new"
                    ? t("product.badge.new")
                    : product.badge === "bestseller"
                      ? t("product.badge.bestseller")
                      : t("product.badge.hot")}
              </span>
            ) : null}

            {/* Zoom lightbox button */}
            {currentItem?.type === "image" ? <button
                onClick={() => setShowLightbox(true)}
                aria-label="Open zoomed view"
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/80 shadow-md flex items-center justify-center hover:bg-card transition-colors"
              >
                <ZoomIn size={18} className="text-foreground" />
              </button> : null}
          </div>

          {/* Thumbnail strip */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {galleryItems.map((item, i) => (
              <button
                key={i}
                onClick={() => { setImageIdx(i); setIsVideoPlaying(false); setIsZoomed(false); }}
                aria-label={item.type === "video" ? `${t("video.gallery.playOverlay")} ${i + 1}` : `View image ${i + 1}`}
                className={[
                  "relative shrink-0 w-[72px] h-[72px] rounded-[var(--radius-md)] bg-surface-elevated border-2 overflow-hidden transition-all duration-150",
                  i === imageIdx
                    ? "border-primary shadow-[0_0_0_3px_var(--primary-light)]"
                    : "border-border hover:border-border-hover hover:-translate-y-0.5",
                ].join(" ")}
              >
                <ImageWithFallback
                  src={item.type === "video" ? item.thumbnailUrl : item.url}
                  alt=""
                  className="w-full h-full object-cover"
                />
                {item.type === "video" ? <>
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Play size={18} className="text-white" aria-hidden="true" />
                    </div>
                    <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-bold uppercase tracking-wider text-white">
                      Video
                    </span>
                  </> : null}
              </button>
            ))}
          </div>

          {/* Dot indicators */}
          {galleryItems.length > 1 ? <div className="flex justify-center gap-2 pt-2" role="tablist" aria-label="Gallery navigation">
              {galleryItems.map((_, i) => (
                <button
                  key={i}
                  role="tab"
                  aria-selected={i === imageIdx}
                  aria-label={`Go to image ${i + 1}`}
                  onClick={() => { setImageIdx(i); setIsVideoPlaying(false); setIsZoomed(false); }}
                  className={[
                    "w-2.5 h-2.5 rounded-full transition-all duration-200",
                    i === imageIdx
                      ? "bg-primary scale-110"
                      : "bg-border hover:bg-primary/50",
                  ].join(" ")}
                />
              ))}
            </div> : null}
        </div>

        {/* Zoom lightbox */}
        <AnimatePresence>
          {showLightbox && currentItem?.type === "image" ? <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
              onClick={() => setShowLightbox(false)}
            >
              <button
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                onClick={() => setShowLightbox(false)}
                aria-label="Close zoomed view"
              >
                <X size={24} className="text-white" />
              </button>
              {galleryItems.length > 1 ? <>
                  <button
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                    onClick={(e) => { e.stopPropagation(); setImageIdx((i) => (i - 1 + galleryItems.length) % galleryItems.length); setIsZoomed(false); }}
                    aria-label="Previous"
                  >
                    <ChevronLeft size={24} className="text-white" />
                  </button>
                  <button
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                    onClick={(e) => { e.stopPropagation(); setImageIdx((i) => (i + 1) % galleryItems.length); setIsZoomed(false); }}
                    aria-label="Next"
                  >
                    <ChevronRight size={24} className="text-white" />
                  </button>
                </> : null}
              <ImageWithFallback
                src={currentItem.url}
                alt={product.name}
                className="max-w-[90vw] max-h-[90vh] object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </motion.div> : null}
        </AnimatePresence>

        {/* ── B. Right Column — Product Info ── */}
        <div className="space-y-5">
          {/* Brand / store badge */}
          <div>
            <button
              onClick={() => void navigate(`/search?cat=${product.category}`)}
              className="text-xs text-primary font-medium hover:underline"
            >
              {product.sellerName ?? product.categoryLabel}
            </button>

            {/* Product name */}
            <h1 className="text-2xl font-bold text-foreground leading-tight mt-1">
              {product.name}
            </h1>

            {/* Rating row */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <StarRating value={product.rating} size={14} />
              <span className="text-sm font-semibold text-foreground">{product.rating}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-sm text-muted-foreground">
                {t("product.soldCount", { count: product.sold })}
              </span>
              <span className="text-muted-foreground">·</span>
              <button
                className="text-sm text-muted-foreground underline"
                onClick={() => setActiveTab("reviews")}
              >
                {t("product.reviewsCount", { count: product.reviewCount })}
              </button>
            </div>
          </div>

          {/* Price block */}
          <div className="flex items-end gap-2 flex-wrap">
            <span className="text-3xl font-bold text-primary">
              {formatPrice(displayPrice)}
            </span>
            {product.originalPrice ? (
              <span className="text-lg line-through text-muted-foreground ml-3">
                {formatPrice(product.originalPrice)}
              </span>
            ) : null}
            {product.discount ? (
              <span className="bg-error text-white text-xs font-semibold px-2 py-0.5 rounded-[var(--radius-sm)] ml-2">
                -{product.discount}%
              </span>
            ) : null}
          </div>
          {savings > 0 ? (
            <p className="text-sm font-medium text-success -mt-2">
              {t("product.savings", { amount: formatPrice(savings) })}
            </p>
          ) : null}

          {/* Colors */}
          {product.colors && product.colors.length > 0 ? (
            <div>
              <p className="text-sm font-semibold text-foreground mb-2">
                {t("product.colorsLabel")}: <span className="font-normal text-muted-foreground">{selectedColor}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {product.colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    aria-pressed={selectedColor === color}
                    className={[
                      "px-3 py-1.5 rounded-[var(--radius-md)] border text-sm font-medium transition-all",
                      selectedColor === color
                        ? "bg-primary text-white border-primary"
                        : "border-border text-foreground hover:border-border-hover",
                    ].join(" ")}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Sizes */}
          {product.sizes && product.sizes.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-foreground">
                  {t("product.sizesLabel")}: <span className="font-normal text-muted-foreground">{selectedSize}</span>
                </p>
                <button
                  className="text-xs font-medium text-primary underline"
                  onClick={() => comingSoon("Size guide", t)}
                >
                  {t("product.sizeGuide")}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    aria-pressed={selectedSize === size}
                    className={[
                      "px-3 py-1.5 rounded-[var(--radius-md)] border text-sm font-medium transition-all",
                      selectedSize === size
                        ? "bg-primary text-white border-primary"
                        : "border-border text-foreground hover:border-border-hover",
                    ].join(" ")}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Quantity stepper */}
          <div>
            <p className="text-sm font-semibold text-foreground mb-2">
              {t("product.quantityLabel")}
            </p>
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-border rounded-[var(--radius-md)] overflow-hidden">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                  className="w-10 h-10 text-muted-foreground hover:bg-surface-elevated flex items-center justify-center font-bold transition-colors"
                >
                  −
                </button>
                <span className="w-12 text-center font-medium text-foreground">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => Math.min(displayStock, q + 1))}
                  aria-label="Increase quantity"
                  className="w-10 h-10 text-muted-foreground hover:bg-surface-elevated flex items-center justify-center font-bold transition-colors"
                >
                  +
                </button>
              </div>
              {displayStock > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {t("product.stockAvailable", { count: displayStock })}
                </span>
              ) : (
                <span className="text-sm font-medium text-red-500">Hết hàng</span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          {displayStock > 0 ? (
            <div className="flex gap-3 items-center">
              <button
                onClick={handleAddToCart}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-primary text-white font-bold rounded-[var(--radius-lg)] hover:opacity-90 transition-opacity"
              >
                <ShoppingCart size={18} />
                {t("product.addToCart")}
              </button>
            <button
              onClick={handleBuyNow}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-accent text-white font-bold rounded-[var(--radius-lg)] hover:opacity-90 transition-opacity"
            >
              <Zap size={18} />
              {t("product.buyNow")}
            </button>
            <button
              onClick={() => toggleWishlist(product.id)}
              aria-label={loved ? "Remove from wishlist" : "Add to wishlist"}
              aria-pressed={loved}
              className={[
                "w-12 h-12 flex items-center justify-center border rounded-[var(--radius-lg)] transition-all shrink-0",
                loved
                  ? "border-primary bg-primary-light text-primary"
                  : "border-border text-muted-foreground hover:border-border-hover",
              ].join(" ")}
            >
              <Heart size={20} fill={loved ? "currentColor" : "none"} />
            </button>
            <button
              onClick={() => {
                void navigator.clipboard.writeText(window.location.href).then(
                  () => toast.success("Link copied!"),
                  () => toast.error("Failed to copy link"),
                );
              }}
              aria-label="Share product"
              className="w-12 h-12 flex items-center justify-center border border-border rounded-[var(--radius-lg)] transition-all shrink-0 text-muted-foreground hover:border-border-hover"
            >
              <Share2 size={20} />
            </button>
          </div>
          ) : (
            <button
              type="button"
              disabled
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-muted text-muted-foreground font-bold rounded-[var(--radius-lg)] cursor-not-allowed"
            >
              <ShoppingCart size={18} />
              Hết hàng
            </button>
          )}

          {/* Trust row */}
          <div className="flex gap-4 flex-wrap">
            {[
              {
                icon: Shield,
                text: t("product.trust.protection"),
              },
              {
                icon: Truck,
                text:
                  product.shippingFee === 0
                    ? t("product.trust.freeShipping")
                    : t("product.trust.shipFee", { fee: formatPrice(product.shippingFee) }),
              },
              {
                icon: RefreshCw,
                text: t("product.trust.returns"),
              },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-1.5">
                <item.icon size={14} className="text-text-secondary shrink-0" />
                <span className="text-xs text-text-secondary">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Seller Info */}
      <SellerCard sellerId={product.sellerId} />

      {/* ── C. Tabs Section ── */}
      <div className="mt-10">
        {/* Tab pills */}
        <div role="tablist" className="flex gap-2 flex-wrap mb-6">
          {(["desc", "specs", "reviews", "qa"] as const).map((tab) => (
            <button
              key={tab}
              id={`product-tab-${tab}`}
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={[
                "px-4 py-2 text-sm font-medium rounded-full transition-colors",
                activeTab === tab
                  ? "bg-primary text-white"
                  : "text-text-secondary hover:bg-surface-elevated",
              ].join(" ")}
            >
              {tab === "desc"
                ? t("product.tabs.desc")
                : tab === "specs"
                  ? t("product.tabs.specs", { defaultValue: "Specifications" })
                  : tab === "reviews"
                    ? t("product.tabs.reviews", { count: product.reviewCount })
                    : t("product.tabs.qa")}
            </button>
          ))}
          {productVideos.length > 0 ? <button
              id="product-tab-videos"
              role="tab"
              aria-selected={activeTab === "videos"}
              aria-label={`${t("video.tab.title")}, ${productVideos.length} ${t("video.gallery.videoCount", { count: productVideos.length })}`}
              onClick={() => setActiveTab("videos")}
              className={[
                "px-4 py-2 text-sm font-medium rounded-full transition-colors",
                activeTab === "videos"
                  ? "bg-primary text-white"
                  : "text-text-secondary hover:bg-surface-elevated",
              ].join(" ")}
            >
              {t("video.tab.title")} ({productVideos.length})
            </button> : null}
        </div>

        <div role="tabpanel" aria-labelledby={`product-tab-${activeTab}`} aria-live="polite">
          {/* Description tab */}
          {activeTab === "desc" ? (
            <div className="space-y-4 bg-card rounded-[var(--radius-xl)] border border-border p-6">
              <p className="text-foreground leading-relaxed">{product.description}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                {[
                  { label: t("product.info.category"), value: product.categoryLabel },
                  { label: t("product.info.origin"), value: product.location },
                  { label: t("product.info.shipping"), value: product.shipping },
                  {
                    label: t("product.info.stockStatus"),
                    value: t("product.info.stockValue", { count: product.stock }),
                  },
                ].map((info) => (
                  <div key={info.label} className="p-3 rounded-[var(--radius-md)] bg-surface-elevated">
                    <p className="text-xs text-muted-foreground mb-0.5">{info.label}</p>
                    <p className="text-sm font-semibold text-foreground">{info.value}</p>
                  </div>
                ))}
              </div>
              {product.tags && product.tags.length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-2">
                  {product.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 rounded-full text-xs bg-surface-elevated text-muted-foreground"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Specifications tab */}
          {activeTab === "specs" ? (
            <div className="bg-card rounded-[var(--radius-xl)] border border-border p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: t("product.info.category"), value: product.categoryLabel },
                  { label: t("product.info.origin"), value: product.location },
                  { label: t("product.info.shipping"), value: product.shipping },
                  {
                    label: t("product.info.stockStatus"),
                    value: t("product.info.stockValue", { count: product.stock }),
                  },
                ].map((info) => (
                  <div key={info.label} className="flex gap-4 py-3 border-b border-border last:border-0">
                    <span className="text-sm text-muted-foreground w-32 shrink-0">{info.label}</span>
                    <span className="text-sm font-medium text-foreground">{info.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Reviews tab */}
          {activeTab === "reviews" ? (
            <div className="space-y-6">
              {/* Rating summary */}
              {liveReviewsQuery.data && liveReviewsQuery.data.length > 0 ? (
                <div className="flex items-center gap-8 p-6 rounded-[var(--radius-xl)] bg-card border border-border">
                  <div className="text-center shrink-0">
                    <p className="text-5xl font-black text-primary">{product.rating}</p>
                    <StarRating value={product.rating} size={16} />
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("product.reviewsCount", { count: product.reviewCount })}
                    </p>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const total = liveReviewsQuery.data?.length ?? 0;
                      const count =
                        liveReviewsQuery.data?.filter((r) => Math.round(r.rating) === star).length ?? 0;
                      const pct = total === 0 ? 0 : Math.round((count / total) * 100);
                      return (
                        <div key={star} className="flex items-center gap-2">
                          <span className="text-xs w-4 text-muted-foreground">{star}</span>
                          <Star size={11} fill="#F59E0B" className="text-amber-400" />
                          <div className="flex-1 h-2 bg-surface-elevated rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-6">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* Empty state */}
              {!liveReviewsQuery.isLoading && liveReviewsQuery.data?.length === 0 ? (
                <div className="py-8 text-center rounded-[var(--radius-xl)] border border-dashed border-border">
                  <MessageCircle size={36} className="mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-semibold text-foreground">
                    {t("product.reviews.beFirstTitle")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("product.reviews.beFirstSubtitle")}
                  </p>
                </div>
              ) : null}

              {/* Write review */}
              {authenticated ? (
                <div className="border border-border rounded-[var(--radius-xl)] p-5 bg-card">
                  <p className="text-sm font-semibold text-foreground mb-2">
                    {t("product.reviews.writeTitle")}
                  </p>
                  <div className="flex items-center gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => setReviewDraft((d) => ({ ...d, rating: n }))}
                        type="button"
                        aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`}
                      >
                        <Star
                          size={20}
                          fill={n <= reviewDraft.rating ? "#F59E0B" : "#e5e7eb"}
                          className={n <= reviewDraft.rating ? "text-amber-400" : "text-gray-200"}
                        />
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={reviewDraft.comment}
                    onChange={(e) => setReviewDraft((d) => ({ ...d, comment: e.target.value }))}
                    rows={3}
                    placeholder={t("product.reviews.placeholder")}
                    className="w-full px-3 py-2 border border-border rounded-[var(--radius-md)] text-sm outline-none focus:border-primary resize-none bg-background"
                  />
                  <button
                    onClick={() => submitReview.mutate(reviewDraft)}
                    disabled={submitReview.isPending || reviewDraft.comment.trim().length === 0}
                    className="mt-3 px-4 py-2 rounded-[var(--radius-md)] bg-primary text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
                  >
                    {submitReview.isPending
                      ? t("product.reviews.submitting")
                      : t("product.reviews.submit")}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => login(`/product/${id}`)}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {t("product.reviews.loginToWrite")}
                </button>
              )}

              {/* Review list */}
              {liveReviewsQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">{t("product.reviews.loading")}</p>
              ) : null}
              {liveReviewsQuery.data && liveReviewsQuery.data.length > 0
                ? liveReviewsQuery.data.map((review) => (
                    <div key={review.id} className="bg-card border border-border rounded-[var(--radius-xl)] p-5">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-9 h-9 rounded-full bg-surface-elevated flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                          {(review.userName ?? "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-sm text-foreground">
                            {review.userName ?? t("product.reviews.anonGuest")}
                          </p>
                          <div className="flex items-center gap-2">
                            <StarRating value={review.rating} size={13} />
                            {review.createdAt ? (
                              <span className="text-xs text-muted-foreground">· {review.createdAt}</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      {review.comment ? (
                        <p className="text-sm text-foreground leading-relaxed mb-3">
                          {review.comment}
                        </p>
                      ) : null}
                      {review.images && review.images.length > 0 ? (
                        <div className="flex gap-2 mb-3">
                          {review.images.map((img) => (
                            <img
                              key={`${review.id}-${img}`}
                              src={img}
                              alt=""
                              className="w-16 h-16 rounded-[var(--radius-md)] object-cover border border-border"
                              loading="lazy"
                            />
                          ))}
                          <ReviewVideoDisplay reviewId={review.id} />
                        </div>
                      ) : (
                        <ReviewVideoDisplay reviewId={review.id} />
                      )}
                      <button
                        onClick={() => voteHelpful.mutate(review.id)}
                        disabled={voteHelpful.isPending}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                      >
                        <ThumbsUp size={13} />{" "}
                        {t("product.reviews.helpful", { count: review.helpful ?? 0 })}
                      </button>
                    </div>
                  ))
                : !liveReviewsQuery.isLoading && liveReviewsQuery.data === undefined && (
                    <div className="py-8 text-center">
                      <MessageCircle size={40} className="mx-auto mb-3 text-muted-foreground opacity-30" />
                      <p className="text-muted-foreground">{t("product.reviews.empty")}</p>
                    </div>
                  )}
            </div>
          ) : null}

          {/* Q&A tab */}
          {activeTab === "qa" ? (
            <div className="space-y-5">
              {authenticated ? (
                <div className="border border-border rounded-[var(--radius-xl)] p-5 bg-card">
                  <p className="text-sm font-semibold text-foreground mb-2">
                    {t("product.qa.askTitle")}
                  </p>
                  <textarea
                    value={questionDraft}
                    onChange={(e) => setQuestionDraft(e.target.value)}
                    rows={3}
                    placeholder={t("product.qa.placeholder")}
                    className="w-full px-3 py-2 border border-border rounded-[var(--radius-md)] text-sm outline-none focus:border-primary resize-none bg-background"
                  />
                  <button
                    onClick={() => submitQuestion.mutate(questionDraft.trim())}
                    disabled={submitQuestion.isPending || questionDraft.trim().length === 0}
                    className="mt-3 px-4 py-2 rounded-[var(--radius-md)] bg-primary text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
                  >
                    {submitQuestion.isPending ? t("product.qa.submitting") : t("product.qa.submit")}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => login(`/product/${id}`)}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {t("product.qa.loginToAsk")}
                </button>
              )}

              {liveQuestionsQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">{t("product.qa.loading")}</p>
              ) : null}

              {liveQuestionsQuery.data && liveQuestionsQuery.data.length > 0 ? (
                <div className="space-y-4">
                  {liveQuestionsQuery.data.map((q) => (
                    <div key={q.id} className="bg-card border border-border rounded-[var(--radius-xl)] p-5">
                      <div className="flex gap-3 mb-2">
                        <span className="shrink-0 w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
                          Q
                        </span>
                        <p className="text-sm font-medium text-foreground">{q.question}</p>
                      </div>
                      {q.answer ? (
                        <div className="flex gap-3 mt-3">
                          <span className="shrink-0 w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center">
                            A
                          </span>
                          <p className="text-sm text-muted-foreground">{q.answer}</p>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground italic pl-9">
                          {t("product.qa.noAnswer")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                !liveQuestionsQuery.isLoading && (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    {t("product.qa.empty")}
                  </div>
                )
              )}
            </div>
          ) : null}

          {activeTab === "videos" ? <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
              aria-busy={isProductVideosLoading}
              aria-live="polite"
            >
              {isProductVideosLoading ? (
                <>
                  <VideoPlayerSkeleton className="rounded-[var(--radius-lg)]" />
                  <VideoPlayerSkeleton className="rounded-[var(--radius-lg)]" />
                </>
              ) : isProductVideosError ? (
                <div className="col-span-full flex flex-col items-center gap-3 py-8 text-center">
                  <p className="text-muted-foreground">{t("video.tab.loadErr")}</p>
                  <button
                    type="button"
                    onClick={() => void refetchProductVideos()}
                    className="text-sm text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary rounded px-3 py-1.5 min-h-[44px]"
                  >
                    {t("common.retry", { defaultValue: "Retry" })}
                  </button>
                </div>
              ) : productVideos.length > 0 ? (
                productVideos.map((video, i) => (
                  <div key={video.id} className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t("video.tab.videoLabel", { index: i + 1, total: productVideos.length })}
                    </p>
                    <VideoPlayer
                      src={video.playbackUrl ?? ""}
                      poster={video.thumbnailUrl ?? ""}
                      title={t("video.tab.videoLabel", { index: i + 1, total: productVideos.length })}
                      className="w-full aspect-video rounded-[var(--radius-lg)]"
                    />
                  </div>
                ))
              ) : (
                <p className="col-span-full text-center text-muted-foreground py-8">
                  {t("video.tab.empty")}
                </p>
              )}
            </div> : null}
        </div>
      </div>

      {/* ── D. Related Products ── */}
      {fbtQuery.data && fbtQuery.data.length > 0 ? (
        <RecommendationGrid
          title={t("product.frequentlyBoughtTogether")}
          items={fbtQuery.data}
          onSelect={(productId) => navigate(`/product/${productId}`)}
        />
      ) : null}

      {ymalQuery.data && ymalQuery.data.length > 0 ? (
        <RecommendationGrid
          title={t("product.youMayAlsoLike")}
          items={ymalQuery.data}
          onSelect={(productId) => navigate(`/product/${productId}`)}
        />
      ) : null}

      {/* Recently Viewed - localStorage only, cross-device requires BE in future sprint */}
      {recentlyViewed.length > 0 ? (
        <RecentlyViewedGrid
          title={t("product.recentlyViewed", { defaultValue: "Recently Viewed" })}
          items={recentlyViewed.filter(item => item.productId !== id).slice(0, 5)}
        />
      ) : null}
    </div>
  );
}

function RecommendationGrid({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: RecommendationItem[];
  onSelect: (productId: string) => void;
}) {
  return (
    <div className="mt-12">
      <h2 className="text-xl font-bold text-foreground mb-5">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {items.map((p) => {
          const discount =
            p.originalPrice && p.price && p.originalPrice > p.price
              ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100)
              : null;
          const displayName = p.name ?? "";
          return (
            <button
              key={p.id}
              type="button"
              className="bg-card rounded-[var(--radius-xl)] border border-border overflow-hidden hover:shadow-md cursor-pointer group transition-all text-left w-full p-0"
              onClick={() => onSelect(p.id)}
            >
              <div className="relative overflow-hidden aspect-square">
                <ImageWithFallback
                  src={p.image ?? ""}
                  alt={displayName}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {discount ? (
                  <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-error text-white text-[10px] font-bold">
                    -{discount}%
                  </span>
                ) : null}
              </div>
              <div className="p-3">
                <p className="text-xs text-text-secondary font-medium line-clamp-2 mb-1">
                  {displayName}
                </p>
                <p className="font-bold text-sm text-primary">
                  {p.price != null ? formatPrice(p.price) : ""}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
