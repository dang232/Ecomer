# Video Upload Pipeline — Architecture Proposal

**Date:** 2026-06-15  
**Status:** Revised (review findings applied 2026-06-15)  
**Authors:** Architecture Team (system design, security, infrastructure)

---

## Executive Summary

This document proposes a Kafka-driven video upload pipeline for the VNShop e-commerce platform, supporting product videos (≤10 min, 500 MB) and review videos (≤5 min, 200 MB). The system handles hundreds of uploads per day with thousands of concurrent viewers, running on a Dell R720 (dual Xeon v4, 128 GB RAM, 1 TB disk).

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Upload protocol | tus (resumable, chunked) | Files up to 500 MB need resume capability |
| Client-side compression | None | Fragmented browser support, bad mobile UX, double-lossy quality loss |
| Transcoding | Server-side FFmpeg, 720p H.264 | Single quality is sufficient for e-commerce; Xeons handle it easily |
| Output format | Progressive MP4 | Native browser playback, no HLS/DASH complexity needed |
| Pipeline orchestration | Kafka topics per stage | Matches existing infra, independent scaling per stage |
| Moderation | Automated NSFW + admin review queue | Belt and suspenders approach |
| Storage lifecycle | Delete raw after transcode | Extends 1 TB disk to ~1 month of content |
| Deployment | All on R720 locally | $50-100/month vs $1,400/month cloud equivalent |
| Video count limits | 3 per product, 1 per review | Prevents unbounded storage use; enforced at API layer |
| Stuck-video reaper | @Scheduled, 10-min threshold | Self-healing for transcoder/moderator crashes |
| Appeal workflow | REJECTED → APPEAL_PENDING | 7-day grace period; admin re-reviews before permanent deletion |

### Trade-offs Accepted

- **Single quality only** — no adaptive bitrate. Acceptable for sub-10-min e-commerce videos.
- **No client compression** — longer uploads but better quality and universal compatibility.
- **1 GbE network caps viewers at ~330 concurrent** — upgrade to 10 GbE or add CDN when going public.
- **FFmpeg on CPU** — 3-4 concurrent transcodes max. Sufficient for hundreds/day (capacity: ~1,150/day).

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  Dell R720 (Dual Xeon v4, 128 GB RAM, 1 TB)                         │
│                                                                      │
│  ┌─────────┐    tus chunked     ┌──────────────┐    ┌─────────────┐ │
│  │ Browser │ ─────────────────▶ │ Video Upload │ ──▶│ MinIO (tmp) │ │
│  │ (Next)  │                    │   Service    │    │             │ │
│  └─────────┘                    └──────┬───────┘    └─────────────┘ │
│                                        │                             │
│                                        ▼ Kafka: video.upload.completed
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Kafka Event Bus                            │   │
│  │                                                              │   │
│  │  video.upload.completed → (transcoder consumes directly)     │   │
│  │  video.transcode.completed → video.moderation.requested      │   │
│  │  video.moderation.completed → (auto-publish or admin queue)  │   │
│  │  video.published / video.rejected → notification-service     │   │
│  └──────────────────────────────────────────────────────────────┘   │
│         │                    │                    │                   │
│         ▼                    ▼                    ▼                   │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────────┐          │
│  │ Transcoder  │    │  Moderator   │    │ Notification   │          │
│  │  (FFmpeg)   │    │  (NudeNet)   │    │   Service      │          │
│  │ 3 workers   │    │  1 worker    │    │  (existing)    │          │
│  └──────┬──────┘    └──────┬───────┘    └────────────────┘          │
│         │                   │                                        │
│         ▼                   │                                        │
│  ┌─────────────┐            │                                        │
│  │ MinIO       │            ▼                                        │
│  │ (staging)   │    ┌──────────────┐                                │
│  └──────┬──────┘    │  PostgreSQL  │                                │
│         │           │  (videos DB) │                                │
│  [moderation pass]  └──────────────┘                                │
│         │                                                            │
│         ▼                                                            │
│  ┌─────────────┐                                                    │
│  │ MinIO       │                                                    │
│  │ (published) │                                                    │
│  └──────┬──────┘                                                    │
│         │                                                            │
│         ▼                                                            │
│  ┌─────────────┐                                                    │
│  │   nginx     │ ◀── thousands of viewers (progressive MP4)         │
│  └─────────────┘                                                    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Component Design

### 1. Video Upload Service (Spring Boot)

**Responsibility:** Accept resumable chunked uploads via tus protocol, validate early, emit events.

**Endpoints:**
```
POST   /api/v1/videos/upload          → tus Creation (returns upload URL)
PATCH  /api/v1/videos/upload/{id}     → tus Upload chunk
HEAD   /api/v1/videos/upload/{id}     → tus Offset query (resume point)
DELETE /api/v1/videos/upload/{id}     → Cancel upload
```

**Idempotency:** POST creation requires an `Upload-Metadata` header containing an `idempotency-key` field (UUID v4, client-generated). Duplicate POSTs with the same key within 24 h return the existing upload URL instead of creating a new record.

**Rate limiting:** Applied to POST (creation) only — 1 req/s burst 3, max 10 creations/day per user. PATCH (chunk) requests are not rate-limited; throttling them breaks resumable upload semantics.

**Integrity:** SHA-256 is computed incrementally during chunked upload (running hash updated per PATCH). The final digest is stored in `sha256_hex` once `Upload-Offset == Upload-Length`. Transcoder verifies this digest before processing (TOCTOU prevention).

**Video count enforcement (API layer):**
- Products: max 3 videos. POST returns HTTP 422 if `owner_type=PRODUCT` and the product already has 3 non-DELETED videos.
- Reviews: max 1 video. POST returns HTTP 422 if `owner_type=REVIEW` and the review already has 1 non-DELETED video.

**First-chunk validation (on first PATCH, offset=0):**
1. Read first 12 bytes — verify magic bytes (ftyp for MP4/MOV, 1A45DFA3 for MKV, RIFF for WebM)
2. Run `ffprobe` on partial file — extract declared duration, resolution, codec
3. Reject immediately if: invalid container, duration exceeds limit, resolution > 3840x2160, codec not in allowlist

**Accepted formats:** MP4, MOV, WebM, MKV  
**Accepted codecs:** H.264, H.265, VP8, VP9, AV1

> **Server-side file size limits:** Review videos are capped at 200 MB; product videos at 500 MB. Enforced in `VideoUploadService.enforceFileSizeLimit()` via the `ownerType` field. The frontend enforces the same 200 MB limit client-side for reviews; the server-side check provides the authoritative enforcement.

**Container sizing:**
```yaml
video-upload-service:
  deploy:
    resources:
      limits:
        memory: 1024M
  environment:
    JAVA_OPTS: -Xms256m -Xmx512m -XX:MaxMetaspaceSize=128m
```

**ObjectStorageClass extension:**
```java
PRODUCT_VIDEO(Duration.ofHours(2), Duration.ofHours(1)),
REVIEW_VIDEO(Duration.ofHours(1), Duration.ofHours(1)),
```

---

### 2. Transcoding Worker (FFmpeg)

**Responsibility:** Convert any accepted video to normalized 720p H.264 progressive MP4.

**FFmpeg command:**
```bash
timeout --signal=KILL 300 ffmpeg -y \
  -t 600 \
  -protocol_whitelist file \
  -i input.{ext} \
  -vf "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease" \
  -c:v libx264 -preset medium -crf 23 \
  -c:a aac -b:a 128k \
  -map 0:v:0 -map 0:a:0 -map_metadata -1 \
  -movflags +faststart \
  -fs 2147483648 \
  -threads 3 \
  -f mp4 output_720p.mp4
```

**Safety flags:**
- `-t 600` — max 10 min input duration
- `-fs 2GB` — max output file size
- `-threads 3` — limit per-job parallelism
- `-protocol_whitelist file` — blocks concat:/http:/data: SSRF vectors
- `-map_metadata -1` — strips all metadata (prevents injection)
- `timeout 300` — kill job after 5 min wall-clock

**Concurrency:** 3 workers, each limited to 3 CPU cores + 2 GB RAM.

**Container sizing:**
```yaml
video-transcoder:
  image: vnshop/transcoder:latest
  deploy:
    replicas: 3
    resources:
      limits:
        cpus: '3.0'
        memory: 2048M
      reservations:
        cpus: '2.0'
        memory: 1024M
  tmpfs:
    - /tmp/transcode:size=4G,noexec
  security_opt:
    - no-new-privileges:true
  read_only: true
  cap_drop:
    - ALL
```

**Workflow per job:**
1. Download raw from `vnshop-video-uploads-tmp` to local tmpfs
2. Verify SHA-256 matches DB record (TOCTOU prevention)
3. Run FFmpeg
4. Generate poster frame at t=10% of duration (fallback: t=1s if duration unknown or < 10s)
5. Upload transcoded MP4 + poster to `vnshop-videos-staging` bucket
6. Emit `video.transcode.completed`
7. Clean local temp files

---

### 3. Moderation Worker (NudeNet)

**Responsibility:** Automated NSFW detection via frame sampling on transcoded output.

**Model:** NudeNet v3 (ONNX, ~300 MB weights, CPU inference ~50ms/frame)

**Frame sampling strategy:**
- Extract 1 frame per 5 seconds from transcoded 720p MP4
- 10-min video = 120 frames → ~6-10 seconds total inference time
- Take MAX score across all frames as video's moderation score

**Scoring thresholds:**

| Score | Verdict | Action |
|-------|---------|--------|
| < 0.3 | AUTO_APPROVED | Publish immediately, notify user |
| 0.3 – 0.7 | PENDING_REVIEW | Enter admin moderation queue |
| > 0.7 | AUTO_REJECTED | Reject immediately, notify user |

**Container sizing:**
```yaml
video-moderator:
  deploy:
    resources:
      limits:
        cpus: '2.0'
        memory: 3072M
      reservations:
        memory: 2048M
```

---

### 4. Admin Review Queue

**Responsibility:** Human moderation for borderline content (score 0.3–0.7).

**Admin endpoints:**
```
GET    /admin/videos/moderation-queue              → list PENDING_REVIEW videos
GET    /admin/videos/{videoId}/preview             → presigned URL for admin viewing
POST   /admin/videos/{videoId}/approve             → publish video
POST   /admin/videos/{videoId}/reject              → reject with reason
GET    /admin/videos/appeal-queue                 → list APPEAL_PENDING videos
POST   /admin/videos/{videoId}/appeal/approve      → re-publish after appeal
POST   /admin/videos/{videoId}/appeal/reject       → confirm rejection, schedule deletion
```

**User video deletion:**
```
DELETE /api/v1/videos/{videoId}                    → owner deletes their own video
```
Transition: `PUBLISHED → DELETED`. Sets `deleted_at`, removes files from MinIO (immediate for staging, scheduled for published to allow CDN cache drain). Admin can also soft-delete via the moderation endpoints.

**On approval:** status → APPROVED → PUBLISHED, emit `video.published`, notify uploader  
**On rejection:** status → REJECTED, emit `video.rejected`, notify uploader with reason, schedule file deletion (7-day grace period for appeals)  
**On appeal:** status → APPEAL_PENDING; uploader notified their appeal is under review. Admin resolves via appeal endpoints above.

---

### 5. Storage Layout

**MinIO Buckets:**

| Bucket | Purpose | Access | Lifecycle |
|--------|---------|--------|-----------|
| `vnshop-video-uploads-tmp` | Raw tus chunks | Private (presigned) | 24h auto-expire |
| `vnshop-videos-staging` | Transcoded files awaiting moderation | Private (presigned, admin only) | Deleted on REJECTED after 7-day grace; promoted to published on approval |
| `vnshop-videos` | Moderation-approved 720p MP4s + posters | Public download | Permanent until DELETED transition |

**Key naming (follows existing pattern):**
```
vnshop-video-uploads-tmp/
  products/{productId}/videos/raw/{uuid}.{ext}
  reviews/{reviewId}/videos/raw/{uuid}.{ext}

vnshop-videos-staging/
  products/{productId}/videos/{uuid}_720p.mp4
  products/{productId}/videos/{uuid}_poster.jpg
  reviews/{reviewId}/videos/{uuid}_720p.mp4
  reviews/{reviewId}/videos/{uuid}_poster.jpg

vnshop-videos/
  products/{productId}/videos/{uuid}_720p.mp4
  products/{productId}/videos/{uuid}_poster.jpg
  reviews/{reviewId}/videos/{uuid}_720p.mp4
  reviews/{reviewId}/videos/{uuid}_poster.jpg
```

**Lifecycle policies:**
- Raw files: deleted after successful transcode (immediate, not 24h)
- Staging files: promoted to `vnshop-videos` on PUBLISHED; deleted after 7-day grace on REJECTED
- Published files: permanent until explicit DELETED transition
- DELETED videos: MinIO files removed immediately for staging; CDN cache drain (5-min TTL) before removal for published

---

### 6. Kafka Topics & Events

**Topics (3 partitions each, matching existing convention):**
```
video.upload.completed
video.transcode.completed
video.transcode.failed
video.moderation.completed
video.published
video.rejected
video.upload.completed.DLT
```

> **Note:** Implementation note — the `moderator-worker` consumes `video.transcode.completed` directly, bypassing the `video.moderation.requested` relay topic. The `video.moderation.completed` topic (and its DLT) is not used; moderation verdicts are stored directly in the `videos` table by the moderator worker and surfaced via the admin REST API.

**Consumer groups:**
```
transcoder-worker          → video.upload.completed (consumes directly, no relay topic)
moderator-worker           → video.transcode.completed
video-service-publish      → (not used; moderation verdict stored in DB directly)
notification-video         → video.published, video.rejected
```

**Retry policy:** 3 attempts, exponential backoff (1s → 5s → 30s), then DLT.

---

### 7. Database Schema

```sql
CREATE TABLE product_svc.videos (
    video_id            UUID PRIMARY KEY,
    owner_type          VARCHAR(32) NOT NULL,     -- 'PRODUCT' | 'REVIEW'
    owner_id            UUID NOT NULL,
    uploader_id         VARCHAR(255) NOT NULL,
    status              VARCHAR(32) NOT NULL,
    raw_object_key      VARCHAR(1024),
    transcoded_object_key VARCHAR(1024),
    poster_object_key   VARCHAR(1024),
    content_type        VARCHAR(255),
    raw_size_bytes      BIGINT,
    transcoded_size_bytes BIGINT,
    duration_seconds    DECIMAL(7,2),             -- e.g. 127.45; supports sub-second precision
    width               INTEGER,
    height              INTEGER,
    sha256_hex          CHAR(64),
    nsfw_score          DECIMAL(4,3),
    moderation_verdict  VARCHAR(32),
    rejection_reason    VARCHAR(500),
    appeal_reason       VARCHAR(1000),            -- uploader-supplied appeal text
    moderated_by        VARCHAR(255),
    moderated_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL,
    updated_at          TIMESTAMPTZ NOT NULL,
    published_at        TIMESTAMPTZ,
    deleted_at          TIMESTAMPTZ               -- soft-delete timestamp for DELETED transition
);

CREATE INDEX idx_videos_owner ON product_svc.videos (owner_type, owner_id);
CREATE INDEX idx_videos_status ON product_svc.videos (status)
    WHERE status IN ('PENDING_REVIEW', 'APPEAL_PENDING', 'UPLOADING', 'TRANSCODING', 'MODERATING');
CREATE INDEX idx_videos_uploader ON product_svc.videos (uploader_id);
CREATE INDEX idx_videos_stuck ON product_svc.videos (status, updated_at)
    WHERE status IN ('UPLOADING', 'TRANSCODING', 'MODERATING');  -- used by stuck-video reaper

CREATE TABLE product_svc.video_status_history (
    id          BIGSERIAL PRIMARY KEY,
    video_id    UUID NOT NULL REFERENCES product_svc.videos(video_id),
    from_status VARCHAR(32),
    to_status   VARCHAR(32) NOT NULL,
    actor_id    VARCHAR(255),
    reason      VARCHAR(500),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 8. State Machine

```
UPLOADING ──────▶ UPLOADED ──────▶ TRANSCODING ──────▶ TRANSCODED ──────▶ MODERATING
    │                                    │                                      │
    │ (24h timeout)              (3 retries fail)                               │
    ▼                                    ▼                                      │
 [expired]                            FAILED                                    │
                                                              ┌────────────────┼────────────────┐
                                                              │                │                │
                                                              ▼                ▼                ▼
                                                       AUTO_APPROVED    PENDING_REVIEW    AUTO_REJECTED
                                                              │           │        │
                                                              │      [approve] [reject]
                                                              │           │        │
                                                              ▼           ▼        ▼
                                                          PUBLISHED   APPROVED  REJECTED
                                                              │            │        │
                                                              │            ▼        ▼
                                                              │        PUBLISHED  APPEAL_PENDING
                                                              │                     │        │
                                                              │           [re-approve] [confirm reject]
                                                              │                     │        │
                                                              ▼                     ▼        ▼
                                                           DELETED              PUBLISHED  REJECTED (final)
```

**Stuck-video reaper** (`@Scheduled(fixedDelay = 60_000)`):
- Queries for videos with `status IN ('UPLOADING','TRANSCODING','MODERATING')` and `updated_at < NOW() - INTERVAL '10 minutes'`
- Transitions them to FAILED with `reason = 'stuck_timeout'`
- Emits a `video.transcode.failed` or `video.moderation.completed` (with FAILED verdict) event so downstream consumers clean up
- Uses index `idx_videos_stuck` for efficient query

**Transition guards:**
- `UPLOADING → UPLOADED`: Upload-Offset == Upload-Length
- `UPLOADED → TRANSCODING`: idempotency check (only from UPLOADED)
- `TRANSCODING → TRANSCODED`: transcoded file verified in storage
- `MODERATING → verdict`: moderation score is present
- `PENDING_REVIEW → APPROVED/REJECTED`: requires ROLE_ADMIN
- `REJECTED → APPEAL_PENDING`: uploader submits appeal within 7-day grace period
- `APPEAL_PENDING → PUBLISHED/REJECTED`: requires ROLE_ADMIN
- `→ PUBLISHED`: transcoded_object_key must be non-null
- `→ DELETED`: only owner or ROLE_ADMIN; only from PUBLISHED state

---

### 9. Frontend Integration

**Upload hook** (extends existing `use-avatar-upload.ts` pattern):
- Uses `tus-js-client` library for resumable uploads
- Client-side pre-validation: file type, file size, estimate duration via browser MediaInfo
- Progress bar with per-chunk accuracy
- Stores upload URL in localStorage for cross-page-refresh resume
- On complete: toast "Video uploaded, processing…"

**Video player:**
- Native HTML5 `<video>` tag — progressive MP4 plays everywhere
- Poster frame from `{uuid}_poster.jpg`
- No third-party player library needed

**Notifications:**
- `VIDEO_PUBLISHED`: "Video đã được duyệt và đang hiển thị"
- `VIDEO_REJECTED`: "Video bị từ chối. Lý do: {reason}"

---

### 10. Error Handling & Backpressure

| Stage | Retry | Backoff | On Exhaust |
|-------|-------|---------|------------|
| Upload (tus) | Infinite (client) | Exponential 1-60s | 24h ILM expiry |
| Transcode | 3 | 30s, 2m, 10m | DLT + FAILED status |
| Moderation | 3 | 10s, 30s, 2m | DLT + FAILED status |
| Publish (DB) | 5 | 1-60s | DLT + manual |

**Backpressure:**
- Kafka consumer `max.poll.records=1` for transcoder
- `max.poll.interval.ms=600000` (10 min) for long transcodes
- Redis semaphore: reject new uploads if transcode queue > 50 or active transcodes > 3
- HTTP 503 + `Retry-After` header when overloaded

---

## Security Requirements

### Critical (Must have before launch)

1. **FFmpeg container isolation** — read-only filesystem, drop all capabilities, no-new-privileges, protocol whitelist (file only)
2. **First-chunk validation** — reject invalid files within first 256 KB, before accepting full upload
3. **TOCTOU prevention** — verify SHA-256 at transcode time matches upload record
4. **Resource limits** — Docker CPU/memory/disk caps on all workers, FFmpeg timeout + output size limits
5. **Video-specific rate limiting** — POST creation: 1 req/s burst 3, max 10 creations/day per user. PATCH (chunk upload) is exempt — throttling chunks breaks resumable upload semantics.
6. **Metadata stripping** — `-map_metadata -1` removes all metadata/subtitles during transcode

### High Priority

7. **Content-Type enforcement** — presigned URL must enforce declared content-type
8. **Separate storage domain** — serve videos from cookieless domain with `X-Content-Type-Options: nosniff`
9. **Concurrent upload limit** — Redis counter, max 2 active tus sessions per user
10. **ClamAV scanning** — async scan before transcode queue

### Medium Priority

11. **CSP update** — add `media-src` directive for video player domain
12. **Content-Disposition headers** — inline with filename on all served videos
13. **NSFW on output** — run moderation on transcoded file (not raw) for consistency

---

## Infrastructure Budget (R720)

### Resource Allocation

| Component | CPU | Memory | Disk I/O |
|-----------|-----|--------|----------|
| Existing services | 8-12 cores | ~21 GB | Moderate |
| FFmpeg workers (×3) | 9 cores | 6 GB | Heavy sequential |
| NSFW moderator | 2 cores | 3 GB | Light |
| Upload service | 2 cores | 1 GB | Write-heavy |
| OS page cache | — | 20-30 GB | — |
| **Headroom** | ~5-10 cores | ~67 GB | — |

### Bottleneck Hierarchy

1. **Network (1 GbE)** — caps at ~330 concurrent viewers. First wall for serving.
2. **Disk I/O (RAID-10 SAS)** — ~840 MB/s peak during 3+ concurrent transcodes. Close to ceiling.
3. **CPU** — comfortable at hundreds/day, hits ceiling at ~1,000+/day.
4. **Memory** — not a concern (67 GB headroom).

### Cloud Migration Triggers

| Signal | Threshold | Action |
|--------|-----------|--------|
| Concurrent viewers > 300 | Sustained 30 min | Add CDN (Cloudflare, already prepared for R2) |
| Disk free < 20% | — | Migrate storage to R2 |
| Queue depth P95 > 100 | Sustained 1 hour | Burst transcode to cloud |
| Daily uploads > 1,000 | Sustained | Full pipeline offload |

---

## Phased Implementation Roadmap

### Phase 1: Core Pipeline (Week 1-2)
- Video DB schema + migration
- Upload service with tus endpoint + first-chunk validation
- MinIO bucket setup (tmp + published)
- Kafka topics creation
- Basic FFmpeg transcoder worker (single instance)

### Phase 2: Safety & Moderation (Week 3)
- FFmpeg container hardening (read-only, cap_drop, protocol whitelist)
- Rate limiting (video-specific tier)
- NSFW moderation worker
- Admin review queue endpoints

### Phase 3: Frontend & Notifications (Week 4)
- Video upload component (tus-js-client)
- Progress tracking UI
- Video player integration (native `<video>`)
- Notification types (published/rejected)

### Phase 4: Hardening (Week 5)
- Scale transcoder to 3 replicas
- Monitoring dashboards (queue depth, transcode latency, disk usage)
- Alerting rules
- ClamAV integration
- Load testing

### Phase 5: Public Readiness (Future)
- 10 GbE NIC upgrade or CDN integration
- TLS on upload endpoint
- CORS configuration
- CDN origin protection
- Storage migration to R2

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Upload success rate | > 99% (excluding user cancellations) |
| Transcode P95 latency | < 5 min for 10-min video |
| Time from upload to published | < 15 min (auto-approved) |
| Concurrent transcodes | 3 without degrading other services |
| NSFW false positive rate | < 5% |
| Video playback start time | < 2s (local network) |
| Disk utilization | < 80% sustained |

---

## Open Questions

1. **Separate video-service or extend product-service?** — Recommend separate service for clean bounded context, but could start in product-service to reduce initial complexity.
2. **NudeNet vs OpenNSFW2?** — Need to benchmark both on R720 CPU. NudeNet is more accurate but heavier.
3. **Appeal workflow for rejected videos?** — Resolved: `REJECTED → APPEAL_PENDING` state added. Appeal endpoint added to admin queue. 7-day grace period enforced.
4. **Video limit per product/review?** — Resolved: 3 videos per product, 1 per review. Enforced at API layer (POST /api/v1/videos/upload returns HTTP 422 when limit reached). Schema index supports efficient count query.

---

## Appendix: Immediate Action Required

> ⚠️ **Security finding during analysis:** Hardcoded secrets (Stripe, PayPal, R2 credentials) are committed in `.env`. These must be rotated immediately and `.env` purged from git history. This is independent of the video pipeline but was flagged during the security review.
