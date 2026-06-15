# Cloudflare Image Resizing — Production Setup

## Overview

In production, images stored in Cloudflare R2 are transformed on-demand via
[Cloudflare Image Resizing](https://developers.cloudflare.com/images/transform-images/).
No additional infrastructure is needed — transforms run at the edge as part of
the Cloudflare CDN request path.

Local development uses imgproxy (see docker-compose.yml) with the same URL
shape so the frontend code works identically in both environments.

## Architecture

```
Browser
  → Cloudflare CDN (cache hit? → serve)
  → Image Resizing (transform on cache miss)
  → R2 origin bucket
```

Transformed variants are cached at the edge. Subsequent requests for the same
transform params hit the CDN cache directly (no re-fetch from R2, no re-encode).

## Prerequisites

1. **Cloudflare Pro plan or higher** — Image Resizing requires at least Pro.
2. **R2 bucket** with a custom domain bound (e.g., `images.vnshop.com`).
3. **Zone active on Cloudflare** — the custom domain must be proxied (orange cloud).

## Setup Steps

### 1. Enable Image Resizing on the zone

Dashboard → Speed → Optimization → Image Resizing → Enable.

Or via API:
```bash
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/{zone_id}/settings/image_resizing" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{"value":"on"}'
```

### 2. Bind R2 bucket to custom domain

Dashboard → R2 → `vnshop-products` bucket → Settings → Public access →
Custom domain → Add `images.vnshop.com`.

Repeat for other buckets if using separate subdomains, or use a single domain
with bucket-name path prefixes.

### 3. Configure Cache Rules

Dashboard → Caching → Cache Rules → Create rule:

- **When**: URI path starts with `/cdn-cgi/image/`
- **Cache eligibility**: Eligible for cache
- **Edge TTL**: 30 days
- **Browser TTL**: 7 days

This ensures transformed images are cached aggressively at both the edge and
in browsers.

### 4. Frontend environment

Set the production environment variables:

```env
VITE_IMAGE_CDN_MODE=cloudflare
```

The frontend `imageUrl()` utility will generate URLs like:
```
/cdn-cgi/image/width=400,height=400,quality=80,format=auto,fit=cover/https://images.vnshop.com/products/{id}/images/{key}.jpg
```

### 5. Backend publicEndpoint

Set the product-service and user-service `PUBLIC_ENDPOINT` env vars to the
R2 custom domain:

```env
OBJECT_STORAGE_PUBLIC_ENDPOINT=https://images.vnshop.com
VNSHOP_USER_STORAGE_PUBLIC_ENDPOINT=https://images.vnshop.com
```

This ensures image URLs returned in API responses use the CDN-backed domain.

## URL Convention

Cloudflare Image Resizing uses the `/cdn-cgi/image/` path prefix:

```
/cdn-cgi/image/{options}/{source_url}
```

**Supported options:**
| Option    | Description                          | Example       |
|-----------|--------------------------------------|---------------|
| `width`   | Target width in pixels               | `width=400`   |
| `height`  | Target height in pixels              | `height=400`  |
| `quality` | JPEG/WebP quality (1-100)            | `quality=80`  |
| `format`  | Output format (`auto`, `webp`, `avif`) | `format=auto` |
| `fit`     | Resize behavior (`cover`, `contain`, `scale-down`) | `fit=cover` |

`format=auto` negotiates WebP/AVIF based on the browser's `Accept` header.

## Presets (matching fe/src/app/lib/image-url.ts)

| Preset      | Width | Height | Quality | Use case                    |
|-------------|-------|--------|---------|-----------------------------|
| `thumbnail` | 72    | 72     | 75      | Cart items, order history   |
| `card`      | 400   | 400    | 80      | Product cards, search grid  |
| `detail`    | 800   | 800    | 85      | Product detail main image   |
| `avatar`    | 160   | 160    | 80      | User/seller avatars         |
| `original`  | —     | —      | 90      | No transform (passthrough)  |

## Fallback Behavior

- If Image Resizing fails (invalid source, unsupported format), Cloudflare
  serves the original image untransformed.
- The frontend `imageUrl()` returns the raw source URL when `VITE_IMAGE_CDN_MODE=none`.
- If `ImageWithFallback` gets a load error, it falls back to the placeholder.

## Cost

- Image Resizing: $0.50 per 1,000 unique transformations (cached results are free).
- R2 egress: Free (zero egress fees).
- Typical site with 1,000 products × 5 presets = 5,000 unique transforms = $2.50 one-time,
  then served from cache indefinitely until cache eviction.

## CORS

The R2 CORS rules in `infra/r2-cors.json` allow browser-direct uploads. For
image serving through the CDN custom domain, CORS is handled automatically by
Cloudflare (same-origin when the frontend is on the same zone, or configured
via Transform Rules if cross-origin).

## Security: Image URL Origin Allowlist

The `/cdn-cgi/image/{params}/{source_url}` path instructs Cloudflare to fetch
`source_url` and transform it. Without validation, a malicious seller could
submit an arbitrary URL (e.g. `https://evil.com/phishing.png`) and Cloudflare
would either proxy it or 302 redirect to it — creating an open redirect on our
domain, or serving attacker-controlled content under our origin.

### Mitigations (implemented)

**Backend (primary):**
- `@ValidImageUrl` annotation on `ImageRequest.url` and `VariantRequest.imageUrl`
  in product-service rejects any URL not matching the configured storage origins.
- Validator checks: well-formed URI, http/https scheme, starts with an allowed
  origin, and the character immediately after the prefix is `/` (prevents
  subdomain spoofing like `images.vnshop.com.evil.com`).
- Allowed origins configured via `vnshop.image-security.allowed-origins` in
  `application.yml`, sourced from `VNSHOP_OBJECT_STORAGE_PUBLIC_ENDPOINT` env var.

**Frontend (defense in depth):**
- `isTrustedOrigin()` in `fe/src/app/lib/image-url.ts` checks `src` against
  `VITE_IMAGE_ALLOWED_ORIGINS` before routing through the CDN transform path.
- Untrusted URLs pass through raw (no `/cdn-cgi/image/` wrapping).
- `cloudflareUrl()` applies `encodeURI(src)` to prevent parameter injection via
  special characters (commas, slashes) in the source URL.

**imgproxy (dev only):**
- `IMGPROXY_ALLOWED_SOURCES: "http://minio:9000/"` restricts fetch targets at
  the proxy layer, preventing SSRF even if a bad URL reaches imgproxy.
- Uses `/insecure/` mode (no HMAC signing) — acceptable for local dev only.
  If ever deployed to production, enable `IMGPROXY_KEY` / `IMGPROXY_SALT`.

### Environment variables

```env
# Backend — allowed storage origins for image URL validation
VNSHOP_OBJECT_STORAGE_PUBLIC_ENDPOINT=https://images.vnshop.com

# Frontend — allowed origins for CDN transform (comma-separated)
VITE_IMAGE_ALLOWED_ORIGINS=https://images.vnshop.com
```

### Attack vectors blocked

| Vector                      | How                                                    |
|-----------------------------|--------------------------------------------------------|
| Open redirect               | CF fetches attacker URL, may 302 → blocked by allowlist |
| Content spoofing            | Attacker image rendered under our domain → blocked      |
| SSRF via imgproxy           | `ALLOWED_SOURCES` + origin check                       |
| Subdomain spoof             | `images.vnshop.com.evil.com` → post-prefix char check  |
| CF parameter injection      | `,format=none` in URL → `encodeURI()` escapes commas   |
| `javascript:`/`data:` URLs  | Scheme check rejects non-http(s)                       |

## Monitoring

- Dashboard → Analytics → Image Resizing — shows transform counts, cache hit rates.
- Dashboard → Caching → Overview — shows overall cache hit ratio for image paths.
- Set up a notification for Image Resizing errors if transform failure rate exceeds threshold.
