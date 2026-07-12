import { IconPhotoOff } from "@tabler/icons-react";
import { useState, type ImgHTMLAttributes } from "react";

type ImageFallbackProps = ImgHTMLAttributes<HTMLImageElement> & {
  /** Optional alternate URL to try before showing the placeholder. */
  fallbackSrc?: string;
  /** Override the placeholder (defaults to a neutral icon on a gray tile). */
  placeholder?: React.ReactNode;
  /** Priority loading for above-the-fold images - disables lazy load, enables fetchpriority. Reduces CLS. */
  priority?: boolean;
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
  onError,
  ...rest
}: ImageFallbackProps) {
  const [errored, setErrored] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);

  // For priority images: eager load + high fetchpriority to prevent CLS
  const imageLoading = priority ? "eager" : loading;
  const imageFetchPriority = priority ? "high" : undefined;

  if (!src || errored) {
    return (
      <div
        className={`flex items-center justify-center bg-muted text-gray-300 ${className ?? ""}`}
        aria-label={alt || "image unavailable"}
      >
        {placeholder ?? <IconPhotoOff size={20} />}
      </div>
    );
  }

  const currentSrc = usingFallback ? fallbackSrc : src;

  return (
    <img
      {...rest}
      src={currentSrc}
      alt={alt}
      className={className}
      loading={imageLoading}
      fetchPriority={imageFetchPriority}
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
