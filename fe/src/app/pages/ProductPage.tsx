import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

import {
  ProductDetail,
  readProductRouteState,
  toProductDetailView,
  updateProductRouteState,
  useProductSeller,
} from "@/features/product";
import { ProductReviewsSection, useProductReviewController } from "@/features/reviews";
import { VideoPlayer, VideoPlayerSkeleton, useProductVideos } from "@/features/videos";
import { ApiError } from "@/shared/api";
import { askQuestion, questionsByProduct } from "@/shared/api/endpoints/questions";
import type { RecommendationItem } from "@/shared/api/endpoints/recommendations";
import { formatPrice } from "@/shared/lib";
import { ImageWithFallback } from "@/shared/ui";

import { usePageMeta } from "../../utils/meta-tags";
import { RecentlyViewedGrid } from "../components/RecentlyViewedGrid";
import { useAuth } from "../hooks/auth-context";
import { productDetailOptions } from "../hooks/use-products";
import { useRecentlyViewed } from "../hooks/use-recently-viewed";
import { useFrequentlyBoughtTogether, useYouMayAlsoLike } from "../hooks/use-recommendations";
import { useVNShop } from "../hooks/use-vnshop";

export function ProductPage() {
  const { id } = useParams();
  return id ? <ProductPageContent productId={id} /> : <Navigate to="/" replace />;
}

function ProductPageContent({ productId }: { productId: string }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();
  const { addToCart, toggleWishlist, isWishlisted } = useVNShop();
  const { authenticated, login } = useAuth();
  const queryClient = useQueryClient();

  const { data: product } = useSuspenseQuery(productDetailOptions(productId));
  const route = useMemo(() => readProductRouteState(searchParams), [searchParams]);
  const seller = useProductSeller(product.sellerId);
  const reviewController = useProductReviewController(productId);
  const { items: recentlyViewed, addToRecentlyViewed } = useRecentlyViewed();
  const fbtQuery = useFrequentlyBoughtTogether(productId);
  const ymalQuery = useYouMayAlsoLike(productId);
  const {
    videos: productVideos,
    isLoading: productVideosLoading,
    isError: productVideosError,
    refetch: refetchProductVideos,
  } = useProductVideos(productId);
  const [selectedColor, setSelectedColor] = useState(product.colors?.[0] ?? "");
  const [selectedSize, setSelectedSize] = useState(product.sizes?.[0] ?? "");
  const [quantity, setQuantity] = useState(1);
  const [questionDraft, setQuestionDraft] = useState("");

  useEffect(() => {
    addToRecentlyViewed(product.id, {
      name: product.name,
      image: product.images?.[0] ?? product.image ?? "",
      price: product.price,
      rating: product.rating,
    });
  }, [addToRecentlyViewed, product]);

  usePageMeta({
    title: product.name,
    description: product.description?.slice(0, 160) ?? `${product.name} - VNShop`,
    image: product.images?.[0] ?? product.image,
  });

  const derivedVariantSku = useMemo(() => {
    if (!product.variants?.length) return "";
    return (
      product.variants.find((variant) => {
        const parts = (variant.name ?? "").split(" / ").map((part) => part.trim());
        return (
          (!selectedColor || parts.includes(selectedColor)) &&
          (!selectedSize || parts.includes(selectedSize))
        );
      })?.sku ?? ""
    );
  }, [product.variants, selectedColor, selectedSize]);
  const selectedVariantSku = route.variant || derivedVariantSku;
  const selectedVariant = product.variants?.find((variant) => variant.sku === selectedVariantSku);
  const detailView = useMemo(
    () =>
      toProductDetailView({
        product: {
          ...product,
          rating: reviewController.summary?.average ?? product.rating,
          sold: product.sold,
        },
        seller,
        selectedVariant: selectedVariantSku || null,
      }),
    [product, reviewController.summary?.average, selectedVariantSku, seller],
  );
  const galleryView = useMemo(() => {
    if (detailView.media.length > 0 || productVideos.length === 0) return detailView;
    return {
      ...detailView,
      media: productVideos
        .filter((video) => Boolean(video.playbackUrl))
        .map((video, index) => ({
          id: video.id,
          url: video.playbackUrl ?? "",
          alt: `${product.name} video ${index + 1}`,
          type: "video" as const,
          poster: video.thumbnailUrl,
        })),
    };
  }, [detailView, product.name, productVideos]);

  const questionsQuery = useQuery({
    queryKey: ["questions", "product", productId],
    queryFn: () => questionsByProduct(productId),
    retry: false,
  });
  const submitQuestion = useMutation({
    mutationFn: (question: string) => askQuestion({ productId, question }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["questions", "product", productId] });
      toast.success(t("product.qa.submitOk"));
      setQuestionDraft("");
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : t("product.qa.submitErr")),
  });
  const updateRoute = (updates: Partial<typeof route>) => {
    setSearchParams((previous) => updateProductRouteState(previous, updates), { replace: true });
  };
  const cartVariant = {
    color: selectedColor || undefined,
    size: selectedSize || undefined,
    variantId: selectedVariant?.sku,
  };
  const addCurrentProductToCart = () => addToCart(product, quantity, cartVariant);
  const buyCurrentProduct = () => {
    addCurrentProductToCart();
    void navigate("/checkout");
  };
  const selectColor = (color: string) => {
    setSelectedColor(color);
    updateRoute({ variant: "" });
  };
  const selectSize = (size: string) => {
    setSelectedSize(size);
    updateRoute({ variant: "" });
  };

  return (
    <>
      <div className="mx-auto w-full max-w-[1440px] px-4 pt-6 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => void navigate("/")}
          className="min-h-[var(--target-web)] rounded-[var(--radius-control)] px-3 py-2 text-sm font-semibold text-primary hover:bg-muted"
        >
          {t("product.backToHome", { defaultValue: "Back to home" })}
        </button>
      </div>
      <ProductDetail
        view={galleryView}
        route={route}
        badge={product.badge}
        colors={product.colors}
        sizes={product.sizes}
        selectedColor={selectedColor}
        selectedSize={selectedSize}
        quantity={quantity}
        loved={isWishlisted(product.id)}
        onRouteChange={updateRoute}
        onQuantityChange={(nextQuantity) => {
          const maxQuantity = detailView.selectedVariant?.stock ?? product.stock;
          setQuantity(Math.max(1, Math.min(nextQuantity, Math.max(1, maxQuantity))));
        }}
        onSelectColor={selectColor}
        onSelectSize={selectSize}
        onToggleWishlist={() => toggleWishlist(product.id)}
        onAddToCart={addCurrentProductToCart}
        onBuyNow={buyCurrentProduct}
        onContactSeller={() => {
          if (detailView.seller.status === "ready") {
            void navigate(`/messages?seller=${encodeURIComponent(detailView.seller.id)}`);
          }
        }}
      >
        <div role="tabpanel" aria-live="polite">
          {route.section === "details" ? <ProductInformation product={product} /> : null}
          {route.section === "reviews" ? (
            <ProductReviewsSection
              controller={reviewController}
              authenticated={authenticated}
              onLogin={() => login(`/product/${productId}?section=reviews`)}
            />
          ) : null}
          {route.section === "questions" ? (
            <ProductQuestions
              authenticated={authenticated}
              draft={questionDraft}
              isLoading={questionsQuery.isLoading}
              isError={questionsQuery.isError}
              isPending={submitQuestion.isPending}
              questions={questionsQuery.data ?? []}
              onDraftChange={setQuestionDraft}
              onLogin={() => login(`/product/${productId}?section=questions`)}
              onRetry={() => void questionsQuery.refetch()}
              onSubmit={() => submitQuestion.mutate(questionDraft.trim())}
            />
          ) : null}
          {route.section === "videos" ? (
            <ProductVideos
              isLoading={productVideosLoading}
              isError={productVideosError}
              onRetry={() => void refetchProductVideos()}
              videos={productVideos}
            />
          ) : null}
        </div>
      </ProductDetail>

      <div className="mx-auto w-full max-w-[1440px] px-4 pb-8 sm:px-6 lg:px-8">
        {fbtQuery.data?.length ? (
          <RecommendationGrid
            title={t("product.frequentlyBoughtTogether")}
            items={fbtQuery.data}
            onSelect={(productId) => void navigate(`/product/${productId}`)}
          />
        ) : null}
        {ymalQuery.data?.length ? (
          <RecommendationGrid
            title={t("product.youMayAlsoLike")}
            items={ymalQuery.data}
            onSelect={(productId) => void navigate(`/product/${productId}`)}
          />
        ) : null}
        {recentlyViewed.length > 0 ? (
          <RecentlyViewedGrid
            title={t("product.recentlyViewed", { defaultValue: "Recently viewed" })}
            items={recentlyViewed.filter((item) => item.productId !== productId).slice(0, 5)}
          />
        ) : null}
      </div>
    </>
  );
}

function ProductInformation({
  product,
}: {
  product: {
    description: string;
    categoryLabel: string;
    location: string;
    shipping: string;
    stock: number;
  };
}) {
  const { t } = useTranslation();
  const information = [
    { label: t("product.info.category"), value: product.categoryLabel },
    { label: t("product.info.origin"), value: product.location },
    { label: t("product.info.shipping"), value: product.shipping },
    {
      label: t("product.info.stockStatus"),
      value: t("product.info.stockValue", { count: product.stock }),
    },
  ];

  return (
    <div className="space-y-6">
      <section className="border border-border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-bold text-foreground">{t("product.tabs.desc")}</h2>
        <p className="mt-3 whitespace-pre-line leading-7 text-foreground">{product.description}</p>
      </section>
      <section className="border border-border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-bold text-foreground">
          {t("product.tabs.specs", { defaultValue: "Specifications" })}
        </h2>
        <dl className="mt-4 grid gap-x-8 gap-y-0 sm:grid-cols-2">
          {information.map((item) => (
            <div key={item.label} className="flex gap-4 border-b border-border py-3">
              <dt className="w-28 shrink-0 text-sm text-muted-foreground">{item.label}</dt>
              <dd className="text-sm font-medium text-foreground">{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

function ProductQuestions({
  authenticated,
  draft,
  isLoading,
  isError,
  isPending,
  questions,
  onDraftChange,
  onLogin,
  onRetry,
  onSubmit,
}: {
  authenticated: boolean;
  draft: string;
  isLoading: boolean;
  isError: boolean;
  isPending: boolean;
  questions: readonly { id: string; question: string; answer?: string | null }[];
  onDraftChange: (value: string) => void;
  onLogin: () => void;
  onRetry: () => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-5">
      {authenticated ? (
        <section className="border border-border bg-card p-5">
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            {t("product.qa.askTitle")}
            <textarea
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              rows={3}
              placeholder={t("product.qa.placeholder")}
              className="w-full resize-none rounded-[var(--radius-control)] border border-border bg-background px-3 py-2 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-ring"
            />
          </label>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isPending || draft.trim().length === 0}
            className="mt-3 min-h-[var(--target-web)] rounded-[var(--radius-control)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? t("product.qa.submitting") : t("product.qa.submit")}
          </button>
        </section>
      ) : (
        <button
          type="button"
          onClick={onLogin}
          className="text-sm font-semibold text-primary hover:underline"
        >
          {t("product.qa.loginToAsk")}
        </button>
      )}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("product.qa.loading")}</p>
      ) : null}
      {isError ? (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">
            {t("product.qa.loadErr", { defaultValue: "Unable to load questions." })}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 text-sm font-semibold text-primary hover:underline"
          >
            {t("common.retry", { defaultValue: "Retry" })}
          </button>
        </div>
      ) : null}
      {!isLoading && !isError && questions.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("product.qa.empty")}</p>
      ) : null}
      {!isLoading && !isError
        ? questions.map((question) => (
            <article key={question.id} className="border border-border bg-card p-5">
              <p className="text-sm font-semibold text-foreground">{question.question}</p>
              {question.answer ? (
                <p className="mt-3 text-sm text-muted-foreground">{question.answer}</p>
              ) : null}
            </article>
          ))
        : null}
    </div>
  );
}

function ProductVideos({
  isLoading,
  isError,
  onRetry,
  videos,
}: {
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  videos: readonly { id: string; playbackUrl?: string | null; thumbnailUrl?: string | null }[];
}) {
  const { t } = useTranslation();
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <VideoPlayerSkeleton />
        <VideoPlayerSkeleton />
      </div>
    );
  }
  if (isError) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground">{t("video.tab.loadErr")}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 text-sm font-semibold text-primary hover:underline"
        >
          {t("common.retry", { defaultValue: "Retry" })}
        </button>
      </div>
    );
  }
  if (videos.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t("video.tab.empty")}</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {videos.map((video, index) => (
        <div key={video.id} className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">
            {t("video.tab.videoLabel", { index: index + 1, total: videos.length })}
          </p>
          <VideoPlayer
            src={video.playbackUrl ?? ""}
            poster={video.thumbnailUrl ?? ""}
            title={t("video.tab.videoLabel", { index: index + 1, total: videos.length })}
            className="aspect-video w-full"
          />
        </div>
      ))}
    </div>
  );
}

function RecommendationGrid({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: readonly RecommendationItem[];
  onSelect: (productId: string) => void;
}) {
  return (
    <section className="mt-12">
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="overflow-hidden border border-border bg-card text-left hover:border-primary"
            onClick={() => onSelect(item.id)}
          >
            <ImageWithFallback
              src={item.image ?? ""}
              alt=""
              className="aspect-square w-full object-cover"
            />
            <div className="p-3">
              <p className="line-clamp-2 min-h-10 text-sm font-medium text-foreground">
                {item.name ?? ""}
              </p>
              <p className="mt-1 text-sm font-bold text-primary">
                {item.price == null ? "" : formatPrice(item.price)}
              </p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
