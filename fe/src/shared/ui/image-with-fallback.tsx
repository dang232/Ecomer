import { ImageOff } from "lucide-react";
import { useState, type ImgHTMLAttributes } from "react";

import { imageSrcSet, imageUrl, type ImagePreset } from "@/shared/lib/image-url";

type ImageFallbackProps = ImgHTMLAttributes<HTMLImageElement> & {
  /** Optional alternate URL to try before showing the placeholder. */
  fallbackSrc?: string;
  /** Override the placeholder (defaults to a neutral icon on a gray tile). */
  placeholder?: React.ReactNode;
  /** Prioritizes above-the-fold images to improve loading/LCP; dimensions prevent CLS. */
  priority?: boolean;
  /** Named CDN transform used to generate responsive image candidates. */
  imagePreset?: ImagePreset;
  /** CDN quality override for this rendered surface. */
  imageQuality?: number;
};

/**
 * Drop-in replacement for `<img>` that swaps to a placeholder when the URL fails.
 * Tries `fallbackSrc` once if provided. Defers loading via `loading="lazy"` by default.
 */
export function ImageWithFallback({
  src,
  fallbackSrc,
  placeholder,
  alt,
  className,
  loading = "lazy",
  decoding = "async",
  priority = false,
  imagePreset = "original",
  imageQuality,
  sizes,
  srcSet,
  onError,
  ...rest
}: ImageFallbackProps) {
  const [errored, setErrored] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);

  // Prioritize above-the-fold images for loading/LCP; stable dimensions prevent CLS.
  const imageLoading = priority ? "eager" : loading;
  const imageFetchPriority = priority ? "high" : undefined;

  if (!src || errored) {
    return (
      <div
        className={`flex items-center justify-center bg-muted text-gray-300 ${className ?? ""}`}
        aria-label={alt || "image unavailable"}
      >
        {placeholder ?? <ImageOff size={20} />}
      </div>
    );
  }

  const currentSrc = usingFallback ? fallbackSrc : src;
  const optimizedSrc = imageUrl(currentSrc, imagePreset, 1, undefined, imageQuality);
  const optimizedSrcSet = usingFallback
    ? undefined
    : imageSrcSet(src, imagePreset, undefined, imageQuality);

  return (
    <img
      {...rest}
      src={optimizedSrc}
      srcSet={srcSet ?? optimizedSrcSet ?? undefined}
      sizes={sizes}
      alt={alt}
      className={className}
      loading={imageLoading}
      {...(imageFetchPriority ? { fetchPriority: imageFetchPriority } : {})}
      decoding={decoding}
      onError={(e) => {
        if (!usingFallback && fallbackSrc) {
          setUsingFallback(true);
        } else {
          setErrored(true);
        }
        onError?.(e);
      }}
    />
  );
}
