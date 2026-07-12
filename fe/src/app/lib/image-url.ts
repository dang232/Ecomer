/**
 * On-demand image transform URL builder.
 *
 * Wraps raw storage URLs (MinIO / R2) with resize + format params:
 * - "imgproxy" mode → local imgproxy container (dev)
 * - "cloudflare" mode → Cloudflare Image Resizing /cdn-cgi/image/ (prod)
 * - "none" mode → passthrough, no transforms
 */

export type ImagePreset = "thumbnail" | "card" | "detail" | "avatar" | "original";

interface PresetConfig {
  width: number;
  height: number;
  quality: number;
}

const PRESETS: Record<ImagePreset, PresetConfig> = {
  thumbnail: { width: 72, height: 72, quality: 75 },
  card: { width: 400, height: 400, quality: 80 },
  detail: { width: 800, height: 800, quality: 85 },
  avatar: { width: 160, height: 160, quality: 80 },
  original: { width: 0, height: 0, quality: 90 },
};

type CdnMode = "imgproxy" | "cloudflare" | "none";

const CDN_MODE: CdnMode =
  (import.meta.env.VITE_IMAGE_CDN_MODE as CdnMode | undefined) ?? "none";
const IMGPROXY_URL: string =
  (import.meta.env.VITE_IMGPROXY_URL as string | undefined) ?? "http://localhost:8081";

/**
 * Allowed origins for image URLs. Only URLs starting with one of these
 * prefixes will be transformed via the CDN layer. Prevents open-redirect
 * and content-spoofing attacks if a malicious URL somehow reaches the frontend.
 */
const ALLOWED_ORIGINS: string[] = (
  (import.meta.env.VITE_IMAGE_ALLOWED_ORIGINS as string | undefined) ?? "http://localhost:9000"
)
  .split(",")
  .map((o: string) => o.trim())
  .filter(Boolean);

/**
 * Returns true if the given src URL belongs to a trusted storage origin.
 * Checks that the character after the origin prefix is '/' (or end of string)
 * to prevent subdomain spoofing (e.g. "images.vnshop.com.evil.com").
 */
function isTrustedOrigin(src: string): boolean {
  return ALLOWED_ORIGINS.some((origin) => {
    if (!src.startsWith(origin)) return false;
    if (src.length === origin.length) return true;
    const next = src[origin.length];
    return next === "/" || next === "?" || next === "#";
  });
}

/**
 * Build a transformed image URL for the given preset.
 *
 * @param src - Raw object-storage URL (e.g. http://localhost:9000/vnshop-products/...)
 * @param preset - Named size preset
 * @param dpr - Device pixel ratio multiplier (default 1)
 * @returns Transformed URL, or original if mode is "none" or src is falsy
 */
export function imageUrl(
  src: string | undefined | null,
  preset: ImagePreset = "original",
  dpr = 1,
): string {
  if (!src) return "";

  const config = PRESETS[preset];
  if (CDN_MODE === "none" || preset === "original") return src;

  // Defense in depth: don't proxy untrusted origins through the CDN
  if (!isTrustedOrigin(src)) return src;

  const w = Math.round(config.width * dpr);
  const h = Math.round(config.height * dpr);

  if (CDN_MODE === "imgproxy") {
    return imgproxyUrl(src, w, h, config.quality);
  }

  return cloudflareUrl(src, w, h, config.quality);
}

/**
 * Generate a srcset string for 1x and 2x variants.
 * Returns empty string for "original" preset or when CDN is disabled.
 */
export function imageSrcSet(
  src: string | undefined | null,
  preset: ImagePreset = "original",
): string {
  if (!src || preset === "original" || CDN_MODE === "none") return "";

  const url1x = imageUrl(src, preset, 1);
  const url2x = imageUrl(src, preset, 2);
  return `${url1x} 1x, ${url2x} 2x`;
}

/**
 * Get the intrinsic display size for a preset (useful for width/height attrs).
 */
export function presetSize(preset: ImagePreset): { width: number; height: number } | null {
  const config = PRESETS[preset];
  if (config.width === 0) return null;
  return { width: config.width, height: config.height };
}

// ─── Internal builders ───────────────────────────────────────────────

function imgproxyUrl(src: string, w: number, h: number, q: number): string {
  // imgproxy URL convention: /insecure/rs:fill:{w}:{h}/q:{q}/plain/{source_url}@webp
  const encoded = encodeURIComponent(src);
  return `${IMGPROXY_URL}/insecure/rs:fill:${w}:${h}/q:${q}/plain/${encoded}@webp`;
}

function cloudflareUrl(src: string, w: number, h: number, q: number): string {
  // Cloudflare Image Resizing: /cdn-cgi/image/width=W,height=H,quality=Q,format=auto,fit=cover/{url}
  const params = `width=${w},height=${h},quality=${q},format=auto,fit=cover`;
  return `/cdn-cgi/image/${params}/${encodeURI(src)}`;
}
