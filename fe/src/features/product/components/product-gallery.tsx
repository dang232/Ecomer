import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useTranslation } from "react-i18next";

import { imageUrl } from "@/shared/lib/image-url";
import { IconButton, ImageWithFallback } from "@/shared/ui";

import type { ProductDetailView } from "../model/product-view";

const focusableSelector = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export interface ProductGalleryProps {
  media: ProductDetailView["media"];
  badge?: string;
}

export function ProductGallery({ media, badge }: ProductGalleryProps) {
  const { t } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);
  const [magnifierPosition, setMagnifierPosition] = useState<{ x: number; y: number } | null>(null);
  const active = media[activeIndex] ?? media[0];
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const zoomTriggerRef = useRef<HTMLButtonElement | null>(null);
  const closeLightbox = useCallback(() => setShowLightbox(false), []);

  useEffect(() => {
    if (!showLightbox) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeLightbox();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [closeLightbox, showLightbox]);

  useEffect(() => {
    if (!showLightbox) return;

    const trigger = zoomTriggerRef.current;
    closeButtonRef.current?.focus();

    return () => trigger?.focus();
  }, [showLightbox]);

  if (!active) {
    return (
      <div
        className="aspect-square border border-border bg-muted"
        aria-label={t("product.gallery", { defaultValue: "Product media gallery" })}
      />
    );
  }

  const move = (direction: -1 | 1) => {
    setActiveIndex((current) => (current + direction + media.length) % media.length);
  };

  const handleLightboxKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || !dialogRef.current) return;

    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
    );
    if (focusable.length === 0) {
      event.preventDefault();
      dialogRef.current.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="space-y-3 lg:sticky lg:top-24 lg:self-start">
      <div
        onPointerMove={(event) => {
          if (event.pointerType !== "mouse") return;
          const rect = event.currentTarget.getBoundingClientRect();
          setMagnifierPosition({
            x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
            y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)),
          });
        }}
        onPointerLeave={() => setMagnifierPosition(null)}
        className="relative aspect-square overflow-hidden rounded-[var(--radius-card)] border border-border bg-muted"
        role="region"
        aria-label={t("product.gallery", { defaultValue: "Product media gallery" })}
      >
        {active.type === "video" ? (
          <video
            src={active.url}
            poster={active.poster ?? undefined}
            controls
            playsInline
            preload="metadata"
            aria-label={active.alt}
            className="h-full w-full object-contain"
          >
            <track kind="captions" src="data:text/vtt,WEBVTT" />
          </video>
        ) : (
          <ImageWithFallback
            src={active.url}
            alt={active.alt}
            className="h-full w-full object-contain"
            imagePreset="detail"
            sizes="(min-width: 1024px) 50vw, 100vw"
          />
        )}
        {magnifierPosition && active.type !== "video" ? (
          <div
            data-testid="product-image-magnifier"
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 hidden bg-no-repeat md:block"
            style={{
              backgroundImage: `url(${imageUrl(active.url, "detail")})`,
              backgroundPosition: `${magnifierPosition.x}% ${magnifierPosition.y}%`,
              backgroundSize: "200%",
            }}
          />
        ) : null}
        {badge ? (
          <span className="absolute left-3 top-3 rounded-[var(--radius-sm)] bg-error px-2 py-1 text-xs font-semibold text-white">
            {badge}
          </span>
        ) : null}
        <button
          type="button"
          onClick={(event) => {
            zoomTriggerRef.current = event.currentTarget;
            setShowLightbox(true);
          }}
          aria-label={t("product.openZoom", { defaultValue: "Open zoomed view" })}
          className="absolute right-3 top-3 flex min-h-[var(--target-web)] min-w-[var(--target-web)] items-center justify-center rounded-full bg-card/90 text-foreground shadow-[var(--shadow-low)] hover:bg-card"
        >
          <ZoomIn className="h-4 w-4" aria-hidden="true" />
        </button>
        {media.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => move(-1)}
              aria-label={t("common.prev", { defaultValue: "Previous" })}
              className="absolute left-3 top-1/2 flex min-h-[var(--target-web)] min-w-[var(--target-web)] -translate-y-1/2 items-center justify-center rounded-full bg-card/90 text-foreground shadow-[var(--shadow-low)] hover:bg-card"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              aria-label={t("common.next", { defaultValue: "Next" })}
              className="absolute right-3 top-1/2 flex min-h-[var(--target-web)] min-w-[var(--target-web)] -translate-y-1/2 items-center justify-center rounded-full bg-card/90 text-foreground shadow-[var(--shadow-low)] hover:bg-card"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </>
        ) : null}
      </div>
      {media.length > 1 ? (
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          aria-label={t("product.gallery", { defaultValue: "Product media gallery" })}
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
              {item.type === "video" ? (
                <video
                  src={item.url}
                  poster={item.poster ?? undefined}
                  muted
                  playsInline
                  preload="metadata"
                  aria-hidden="true"
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImageWithFallback
                  src={item.url}
                  alt=""
                  className="h-full w-full object-cover"
                  imagePreset="thumbnail"
                  sizes="72px"
                />
              )}
            </button>
          ))}
        </div>
      ) : null}
      {showLightbox ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={t("product.zoomedImage", { defaultValue: "Zoomed product image" })}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6"
          tabIndex={-1}
          onKeyDown={handleLightboxKeyDown}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeLightbox();
          }}
        >
          <IconButton
            ref={closeButtonRef}
            label={t("product.closeZoom", { defaultValue: "Close zoomed view" })}
            onClick={closeLightbox}
            className="absolute right-4 top-4 z-10 rounded-full bg-card/90 text-foreground shadow-[var(--shadow-low)] hover:bg-card"
          >
            <X />
          </IconButton>
          {active.type === "video" ? (
            <video
              src={active.url}
              poster={active.poster ?? undefined}
              controls
              autoPlay
              playsInline
              aria-label={active.alt}
              className="max-h-full max-w-full object-contain"
              onClick={(event) => event.stopPropagation()}
            >
              <track kind="captions" src="data:text/vtt,WEBVTT" />
            </video>
          ) : (
            <ImageWithFallback
              src={active.url}
              alt={active.alt}
              className="max-h-full max-w-full object-contain"
              imagePreset="detail"
              sizes="100vw"
              onClick={(event) => event.stopPropagation()}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
