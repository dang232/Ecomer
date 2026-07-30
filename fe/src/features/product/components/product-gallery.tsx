import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ImageWithFallback } from "@/shared/ui";

import type { ProductDetailView } from "../model/product-view";

export interface ProductGalleryProps {
  media: ProductDetailView["media"];
  badge?: string;
}

export function ProductGallery({ media, badge }: ProductGalleryProps) {
  const { t } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);
  const active = media[activeIndex] ?? media[0];

  if (!active) {
    return (
      <div
        className="aspect-square border border-border bg-muted"
        aria-label={t("product.gallery", { defaultValue: "Product gallery" })}
      />
    );
  }

  const move = (direction: -1 | 1) => {
    setActiveIndex((current) => (current + direction + media.length) % media.length);
  };

  return (
    <div className="space-y-3 lg:sticky lg:top-24 lg:self-start">
      <div
        className="relative aspect-square overflow-hidden rounded-[var(--radius-card)] border border-border bg-muted"
        role="region"
        aria-label={t("product.gallery", { defaultValue: "Product gallery" })}
      >
        <ImageWithFallback
          src={active.url}
          alt={active.alt}
          className="h-full w-full object-contain"
        />
        {badge ? (
          <span className="absolute left-3 top-3 rounded-[var(--radius-sm)] bg-error px-2 py-1 text-xs font-semibold text-white">
            {badge}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => setShowLightbox(true)}
          aria-label={t("product.openZoom", { defaultValue: "Open zoomed view" })}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-card/90 text-foreground shadow-[var(--shadow-low)] hover:bg-card"
        >
          <ZoomIn className="h-4 w-4" aria-hidden="true" />
        </button>
        {media.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => move(-1)}
              aria-label={t("common.prev", { defaultValue: "Previous" })}
              className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-card/90 text-foreground shadow-[var(--shadow-low)] hover:bg-card"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              aria-label={t("common.next", { defaultValue: "Next" })}
              className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-card/90 text-foreground shadow-[var(--shadow-low)] hover:bg-card"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </>
        ) : null}
      </div>
      {media.length > 1 ? (
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          aria-label={t("product.gallery", { defaultValue: "Product gallery" })}
        >
          {media.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={t("product.viewImage", {
                index: index + 1,
                defaultValue: "View image {{index}}",
              })}
              aria-pressed={index === activeIndex}
              className={`h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[var(--radius-control)] border-2 bg-muted ${
                index === activeIndex ? "border-primary" : "border-border hover:border-border-hover"
              }`}
            >
              <ImageWithFallback src={item.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
      {showLightbox ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("product.zoomedImage", { defaultValue: "Zoomed product image" })}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6"
          tabIndex={-1}
          onClick={() => setShowLightbox(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setShowLightbox(false);
          }}
        >
          <ImageWithFallback
            src={active.url}
            alt={active.alt}
            className="max-h-full max-w-full object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}
