import { Link } from "react-router";
import { useEffect, useRef, useState } from "react";

import { videosByEntity } from "@/shared/api/endpoints/videos";
import type { Video } from "@/shared/contracts/api/video";
import { ImageWithFallback, StatusIndicator } from "@/shared/ui";

import { Price } from "./price";
import { Rating } from "./rating";
import { SellerIdentity } from "./seller-identity";

export interface ProductTileView {
  id: string;
  name: string;
  imageUrl?: string;
  priceVnd: number;
  originalPriceVnd?: number;
  rating?: number;
  soldCount?: number;
  sellerName?: string;
  stockState: "in-stock" | "low-stock" | "unavailable";
}

export interface ProductTileProps {
  product: ProductTileView;
  href: string;
}

const stockLabels: Record<Exclude<ProductTileView["stockState"], "in-stock">, string> = {
  "low-stock": "Low stock",
  unavailable: "Unavailable",
};

export function ProductTile({ product, href }: ProductTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pointerInsideRef = useRef(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewRequested, setPreviewRequested] = useState(false);
  const [productVideos, setProductVideos] = useState<Video[]>([]);
  const previewVideo = productVideos.find(
    (video) => video.status === "PUBLISHED" && Boolean(video.playbackUrl),
  );
  const stockLabel = product.stockState === "in-stock" ? null : stockLabels[product.stockState];

  useEffect(() => () => videoRef.current?.pause(), []);

  useEffect(() => {
    if (!previewRequested) return;

    const controller = new AbortController();
    void videosByEntity(product.id, "PRODUCT", controller.signal)
      .then((response) => setProductVideos(response.videos))
      .catch(() => undefined);

    return () => controller.abort();
  }, [previewRequested, product.id]);

  useEffect(() => {
    if (!previewVideo?.playbackUrl || !pointerInsideRef.current) return;
    setPreviewing(true);
    void videoRef.current?.play().catch(() => setPreviewing(false));
  }, [previewVideo?.playbackUrl]);

  const startPreview = (pointerType?: string) => {
    if (pointerType && pointerType !== "mouse") return;
    pointerInsideRef.current = true;
    setPreviewRequested(true);
    if (!previewVideo?.playbackUrl) return;
    setPreviewing(true);
    const video = videoRef.current;
    if (video) void video.play().catch(() => setPreviewing(false));
  };

  const stopPreview = () => {
    pointerInsideRef.current = false;
    setPreviewing(false);
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
  };

  return (
    <article
      data-testid="product-card"
      className="grid h-full min-h-[22rem] grid-rows-[auto_minmax(3rem,auto)_auto_auto] overflow-hidden rounded-[var(--radius-card)] border border-border bg-card"
    >
      <div data-testid="product-tile" className="contents">
        <Link
          to={href}
          aria-label={product.name}
          onPointerEnter={(event) => startPreview(event.pointerType)}
          onPointerLeave={stopPreview}
          onFocus={() => startPreview("mouse")}
          onBlur={stopPreview}
          className="group aspect-square overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <ImageWithFallback
            className={`${previewing ? "opacity-0" : "opacity-100"} h-full w-full object-cover transition-opacity duration-[var(--duration-fast)] motion-reduce:transform-none`}
            src={product.imageUrl ?? previewVideo?.thumbnailUrl ?? ""}
            alt={product.name}
            imagePreset="card"
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          />
          {previewVideo?.playbackUrl ? (
            <video
              ref={videoRef}
              data-testid="product-video-preview"
              src={previewVideo.playbackUrl}
              poster={previewVideo.thumbnailUrl ?? undefined}
              muted
              playsInline
              loop
              preload="metadata"
              aria-hidden="true"
              className={`${previewing ? "opacity-100" : "opacity-0"} pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-[var(--duration-fast)] motion-reduce:hidden`}
            >
              <track kind="captions" src="data:text/vtt,WEBVTT" />
            </video>
          ) : null}
        </Link>
        <h3 className="min-h-12 px-3 pt-3 text-sm font-medium leading-5 text-foreground">
          <span className="line-clamp-2">{product.name}</span>
        </h3>
        <Price priceVnd={product.priceVnd} originalPriceVnd={product.originalPriceVnd} />
        <div className="min-h-11 px-3 pb-3">
          <Rating value={product.rating} soldCount={product.soldCount} />
          {product.sellerName ? <SellerIdentity name={product.sellerName} /> : null}
          {stockLabel ? (
            <div className="mt-2">
              <StatusIndicator tone={product.stockState === "unavailable" ? "danger" : "warning"}>
                {stockLabel}
              </StatusIndicator>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
