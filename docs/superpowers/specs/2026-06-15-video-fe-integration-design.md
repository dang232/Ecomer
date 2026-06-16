# Video Pipeline FE Integration — Design Spec

**Date:** 2026-06-15  
**Status:** Approved  
**Authors:** Architecture Team (FE integration, customer behavior, BA)

---

## 1. Problem Statement

The video upload pipeline backend is complete (5,257 lines: tus upload, FFmpeg transcode, NudeNet moderation, admin approve/reject, appeal flow) but **none of it is reachable from the UI**. Video components exist as standalone files with passing tests but are not imported by any page. A seller cannot upload videos, a buyer cannot watch them, and an admin cannot moderate them.

### Business Impact

- Sellers have no way to showcase products in motion → losing to Shopee/Tiki competitors who support video
- Buyers can't see products "in real life" before buying → higher return rates, lower trust
- Admin moderation queue (`PENDING_REVIEW` videos) accumulates silently with no UI to drain it
- Video notifications fire into the void (no deepLink destination renders video content)

---

## 2. User Journeys

| # | Journey | Persona | Entry Point | Exit Point |
|---|---|---|---|---|
| 1 | Seller uploads product video | Seller | Product modal → Videos section | Toast "processing" → notification when published |
| 2 | Buyer watches product video | Buyer | Product page gallery (▶ thumbnail) or Videos tab | Inline playback / full-screen in tab |
| 3 | Buyer attaches review video | Buyer | Write review form → video upload button | Video appears inline in review card after moderation |
| 4 | Admin moderates flagged video | Admin | Sidebar → "Video Moderation" tab | Approve/reject action → seller notified |
| 5 | Seller sees rejection + appeals | Seller | VIDEO_REJECTED notification → seller dashboard | Appeal submitted → status changes to APPEAL_PENDING |
| 6 | Buyer sees "video is live" | Buyer | VIDEO_PUBLISHED notification → product page | Review video visible inline |

---

## 3. Integration Points

### 3.1 ProductPage.tsx — Gallery + Tab (Amazon/Shopee style)

**Gallery integration:** [UPDATED — video FIRST, discriminated union]
- Videos appear as the FIRST slides in the gallery, before product images
- Gallery state uses discriminated union: `type GalleryItem = { type: "image"; url: string } | { type: "video"; playbackUrl: string; thumbnailUrl: string; durationSeconds?: number }`
- Each video thumbnail (poster frame) has a semi-transparent ▶ play icon overlay
- Clicking a video thumbnail replaces the main gallery area with the `VideoPlayer` component (inline playback, muted by default)
- Player uses `aspect-video` with `object-contain` inside the existing gallery container
- Escape key or ✕ button returns to poster/thumbnail view
- `playsinline` attribute for iOS Safari compatibility
- Thumbnail row shows video entries with a small film-strip icon to distinguish from photos

**Videos tab:** [UPDATED — conditional visibility]
- New 5th tab: `"videos"` added to `activeTab` union type (`"desc" | "specs" | "reviews" | "qa" | "videos"`)
- Tab is HIDDEN when video count is 0 (no empty tab for products without videos)
- Tab label: "Videos" with count badge, e.g., "Videos (2)" — plain text, no emoji (matches codebase convention)
- Tab content: grid of `VideoPlayer` components for all PUBLISHED videos on this product
- Empty state (edge case: all videos rejected after tab was visible): "No videos available"

**Data flow:** [UPDATED — aligned with existing FE types]
- New hook: `useProductVideos(productId: string)` → calls existing `videosByEntity(productId, "PRODUCT")` which hits `GET /videos?entityId={productId}&context=PRODUCT`
- Returns `{ videos: Video[], isLoading: boolean }`
- `Video` shape (from `fe/src/app/types/api/video.ts`): `{ id, entityId, context, status, playbackUrl, thumbnailUrl, durationSeconds, uploadedAt, publishedAt }`
- Cache key: `["videos", "product", productId]`

### 3.2 seller-product-modal.tsx — Video Upload Section

**Position:** Below the Images grid, above the Name field.

**Layout:**
```
┌─ Videos (0/3) ─────────────────────────────────────────┐
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  📤 Drop video here or click to browse           │  │
│  │  MP4, MOV, WebM, MKV • Max 500 MB               │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

After upload starts:
```
┌─ Videos (1/3) ─────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────┐  │
│  │  ▶ demo.mp4          ⏳ TRANSCODING              │  │
│  │  ████████████░░░░░░  65%                         │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  📤 Drop video here or click to browse           │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Behavior:** [UPDATED — aligned with actual hook interface]
- Uses `useVideoUpload({ entityId: productId, context: "PRODUCT", onComplete, onError })`
- Hook returns `{ state, upload, cancel, reset }` where `state: { phase, progress, videoId, error, estimatedDuration, filename }`
- Shows `VideoUploadDropzone` when slots available (max 3 - existing count)
- Shows `VideoUploadProgress` for in-flight uploads (pipeline stepper)
- Shows existing videos with status badge + delete button (only PUBLISHED can be deleted by owner)
- Upload cancel: show ✕ button next to progress bar, calls `cancel()` from hook
- `isBusy` gate: modal shows confirmation dialog on close attempt while upload is in flight (not hard-blocked)
- Create mode: [UPDATED] video file selection is ALLOWED during product creation. Files are queued locally; tus upload fires automatically after the initial product save returns a productId/entityId. Same pattern as staged images.

**Constraints:**
- Max 3 videos per product (enforced client-side + server-side)
- Max 500 MB per video
- Max 120 seconds duration (enforced via `preflightVideo()` in upload hook)
- Allowed formats: MP4, MOV, WebM, MKV

### 3.3 Review Video — Upload + Display

**CreateReviewForm (upload):** [UPDATED]
- Below the photo attachment row, add a "Add video" button (film icon)
- Clicking opens the `VideoUploadDropzone` inline (collapsed by default)
- Max 1 video per review, max 200 MB, max 60 seconds duration
- Uses `useVideoUpload({ entityId: reviewId, context: "REVIEW", onComplete, onError })`
- After upload completes, show the `VideoUploadProgress` stepper until PUBLISHED
- Form submission is NOT blocked by video processing — the video appears in the review card asynchronously once moderation passes
- **Entity linking:** Video upload button is disabled until the review is submitted (needs reviewId). Alternatively, use a two-step flow: submit review first, then prompt "Add a video to your review?" with the newly created reviewId.

**ReviewCard (display):**
- If the review has an attached video (status=PUBLISHED), show it in the media row alongside photos
- Video thumbnail has ▶ overlay, clicking plays inline via `VideoPlayer`
- Video always renders AFTER photos in the media row (last position)
- If video is still processing (TRANSCODING/MODERATING), show a disabled thumbnail with "Processing..." label

### 3.4 AdminPage.tsx — Video Moderation Sidebar Tab

**Sidebar entry:**
- New item in `NAV_ITEMS` array: `{ id: "videoModeration", labelKey: "admin.nav.videoModeration", icon: IconVideo }`
- Badge count: number of videos with status `PENDING_REVIEW` (fetched from existing `adminVideoModerationQueue` endpoint)
- Position: after "Reviews" in the sidebar order

**Conditional render:**
```tsx
{activeTab === "videoModeration" && <VideoModerationPanel />}
```

**VideoModerationPanel:** [UPDATED — this is a NEW component, not pre-existing]
- Two sub-tabs: "Queue" (renders `VideoModeration.tsx`) and "Appeals" (renders `VideoAppeals.tsx`)
- `VideoModeration.tsx` and `VideoAppeals.tsx` already exist and are tested (10 vitest tests pass)
- `VideoModerationPanel` wrapper with sub-tab state must be CREATED as a new component
- Just need to build the wrapper, then import and render the existing components inside it

### 3.5 Notifications — Icon Map + Deep Links

**notification-type.enum (already done in backend):**
- `VIDEO_PUBLISHED` and `VIDEO_REJECTED` already exist in the notification-service

**FE notification-icon.tsx:**
- Add to `ICON_MAP`: `VIDEO_PUBLISHED → IconPlayerPlay` (green-500)
- Add to `ICON_MAP`: `VIDEO_REJECTED → IconPlayerStop` (red-500)

**Deep link routing (already handled by react-router):** [UPDATED]
- `VIDEO_PUBLISHED` sends `deepLink: "/product/{productId}"` → buyer clicks → product page (video now in gallery)
- `VIDEO_REJECTED` sends `deepLink: "/seller/products/{productId}"` → seller clicks → seller product modal (where they see rejection + can appeal)

**FE notification type schema:**
- Add `VIDEO_PUBLISHED` and `VIDEO_REJECTED` to `notificationTypeSchema` Zod enum in `fe/src/app/types/api/notification.ts`

---

## 4. API Endpoint [UPDATED — aligned with existing FE endpoint wrapper]

### GET /videos (already defined in FE, backend needs implementation)

**Purpose:** Fetch published videos for a product or review (buyer-facing, public).

**FE endpoint wrapper (already exists at `fe/src/app/lib/api/endpoints/videos.ts`):**
```ts
export const videosByEntity = (entityId: string, context: "PRODUCT" | "REVIEW") =>
  api.get("/videos", videoListSchema, { entityId, context }, { auth: false });
```

**Query params:**
- `entityId` (required): UUID of the product or review
- `context` (required): `PRODUCT` | `REVIEW`
- Status filtering is implicit — backend returns only PUBLISHED for unauthenticated requests

**Response (matches existing `videoListSchema`):**
```json
{
  "videos": [
    {
      "id": "uuid",
      "entityId": "product-uuid",
      "context": "PRODUCT",
      "status": "PUBLISHED",
      "playbackUrl": "https://minio/vnshop-videos/products/{id}/videos/{uuid}_720p.mp4",
      "thumbnailUrl": "https://minio/vnshop-videos/products/{id}/videos/{uuid}_poster.jpg",
      "durationSeconds": 127.45,
      "uploadedAt": "2026-06-15T10:00:00Z",
      "publishedAt": "2026-06-15T10:05:00Z"
    }
  ]
}
```

**Backend (MUST BE BUILT — does not exist yet):**
- New JPA query: `findByOwnerTypeAndOwnerIdAndStatus(ownerType, ownerId, status)` on `VideoJpaSpringDataRepository`
- New controller endpoint on `VideoController`
- Security config: whitelist as public route (no auth required for buyer-facing)
- Map JPA entity fields to response DTO: `public_key` → `playbackUrl`, `poster_object_key` → `thumbnailUrl`

---

## 5. Hooks [UPDATED — aligned with existing types and endpoints]

### useProductVideos(productId: string)
```ts
const { videos, isLoading } = useProductVideos(productId);
// Calls videosByEntity(productId, "PRODUCT") → GET /videos?entityId={productId}&context=PRODUCT
// Returns Video[] from videoListSchema (id, playbackUrl, thumbnailUrl, durationSeconds, etc.)
// Cache key: ["videos", "product", productId]
```

### useReviewVideo(reviewId: string)
```ts
const { video, isLoading } = useReviewVideo(reviewId);
// Calls videosByEntity(reviewId, "REVIEW") → GET /videos?entityId={reviewId}&context=REVIEW
// Returns first (only) video or null
// Cache key: ["videos", "review", reviewId]
```

### Existing hooks (already implemented):

**useVideoUpload** (`fe/src/features/videos/hooks/useVideoUpload.ts`)
```ts
interface VideoUploadOptions {
  entityId: string;
  context: "PRODUCT" | "REVIEW";
  onComplete?: (videoId: string) => void;
  onError?: (error: Error) => void;
}
function useVideoUpload(options: VideoUploadOptions): {
  state: { phase, progress, videoId, error, estimatedDuration, filename };
  upload: (file: File) => void;
  cancel: () => void;
  reset: () => void;
}
```

**useVideoStatus** (`fe/src/features/videos/hooks/useVideoStatus.ts`)
```ts
function useVideoStatus(videoId: string | null, options?: { enabled?: boolean }): {
  status: VideoStatus | undefined;
  data: VideoStatusResponse | undefined;  // includes rejectionReason, thumbnailUrl, playbackUrl
  isStuck: boolean;   // true after 15 minutes in non-terminal state
  error: Error | null;
  isLoading: boolean;
}
// Polls at: UPLOADING=3s, TRANSCODING=5s, MODERATING=5s
// Stops on terminal: PUBLISHED, REJECTED, FAILED
```

---

## 6. i18n Keys (en + vi) [UPDATED]

```json
{
  "video.gallery.playOverlay": "Play video",
  "video.gallery.videoCount": "{{count}} video(s)",
  "video.gallery.closePlayer": "Close video player",
  "video.tab.title": "Videos",
  "video.tab.empty": "No videos available",
  "video.seller.sectionTitle": "Videos ({{count}}/{{max}})",
  "video.seller.createFirst": "Videos will upload after you save the product",
  "video.seller.deleteConfirm": "Remove this video? This cannot be undone.",
  "video.seller.cancelUpload": "Cancel upload?",
  "video.seller.durationLimit": "Max {{seconds}} seconds",
  "video.review.addButton": "Add video",
  "video.review.processing": "Processing...",
  "video.review.maxSize": "Max 200 MB",
  "video.review.durationLimit": "Max 60 seconds",
  "admin.nav.videoModeration": "Video Moderation",
  "admin.nav.videoAppeals": "Video Appeals"
}
```

Vietnamese translations follow the same structure with localized copy.

---

## 7. Accessibility [UPDATED — expanded with gaps identified in review]

- Video thumbnails in gallery: `role="button"` + `aria-label="Play video: {title}"`
- VideoPlayer: native `<video>` controls (already accessible)
- Tab: `role="tab"` + `aria-selected` (follows existing tab pattern)
- Tab badge: `aria-label="Videos, {{count}} videos available"` (count in accessible name)
- Upload dropzone: `aria-label="Upload video, click to browse files"` + keyboard-activatable (Enter/Space)
- Admin moderation: focus management on approve/reject actions
- Gallery-to-player transition: wrap player in `aria-live="polite"` region so screen readers announce context change
- Upload progress stepper: `aria-live="polite"` on status text for dynamic updates
- Keyboard exit from inline player: Escape key returns to gallery thumbnail view
- Respect `prefers-reduced-motion`: disable framer-motion transitions for gallery animations
- Video captions: product demo videos are exempt from WCAG 1.2.2 (no speech content); document as design decision

---

## 8. Error States

| Scenario | User sees |
|---|---|
| No videos on product | "Videos" tab badge shows (0), tab content shows empty state |
| Video upload fails (network) | Toast error + retry button in dropzone |
| Video processing stuck (>15 min) | "Taking longer than expected" banner with support link |
| Video rejected | Seller sees rejection reason + "Appeal" button in product modal |
| Max videos reached (3/product, 1/review) | Upload button disabled + tooltip "Maximum videos reached" |

---

## 9. Implementation — 10 Agent Team

| Agent | Type | Scope | Files | Tests |
|---|---|---|---|---|
| 1 | designer | Product gallery: video thumbnails as FIRST carousel slides with ▶ overlay, discriminated union GalleryItem[] | `ProductPage.tsx` | Visual regression |
| 2 | executor | Product Videos tab: 5th tab, useProductVideos hook, VideoPlayer grid | `ProductPage.tsx`, new hook | vitest |
| 3 | executor | Seller modal: Videos section below images with upload + existing list | `seller-product-modal.tsx` | vitest |
| 4 | executor | Review upload: video button in CreateReviewForm | Review form component | vitest |
| 5 | executor | Review display: video in ReviewCard media row | ReviewCard component | vitest |
| 6 | executor | Admin sidebar: "Video Moderation" tab wiring | `AdminPage.tsx` | vitest |
| 7 | executor | Notification icons + deepLink types | `notification-icon.tsx`, `notification.ts` | vitest |
| 8 | executor | Backend: GET /videos endpoint + FE hooks (useProductVideos, useReviewVideo) | VideoController + new hooks | mvn + vitest |
| 9 | executor | i18n: all new keys in en.json + vi.json + a11y ARIA | i18n files | lint |
| 10 | test-engineer | E2E QA: 6 customer journeys, screenshot evidence | QA report | playwright/manual |

**Dependencies:**
- Agent 8 (API + hooks) unblocks agents 1, 2, 4, 5
- Agent 3 can start immediately (uses existing `useVideoUpload` hook)
- Agent 6 can start immediately (imports existing components)
- Agent 7 can start immediately (just icon/type mapping)
- Agent 9 runs in parallel (i18n keys)
- Agent 10 runs last (verifies everything)

---

## 10. Out of Scope

- Video editing (trim, crop) — future
- Video analytics (view counts, engagement) — future
- Video CDN / adaptive bitrate — Phase 5 in spec
- Video comments / timestamped notes — future
- Seller video management page — deferred (seller uses product modal for now)
- Video thumbnails selection (custom poster frame) — uses auto-generated t=10% poster

---

## 11. Success Metrics

| Metric | Target |
|---|---|
| Seller video upload success rate | > 95% (excluding user cancellations) |
| Time from upload → visible on product page | < 15 min (auto-approved) |
| Buyer video engagement (play rate) | > 10% of product page views |
| Admin moderation queue drain time | < 4 hours for PENDING_REVIEW |
| Review video attachment rate | > 2% of reviews (organic, no prompting) |

---

## 12. Prerequisites [NEW — must be resolved before implementation]

### 12.1 Backend GET /videos Endpoint (Critical Blocker)

The FE endpoint wrapper `videosByEntity()` already exists but the backend does NOT serve this route. Must build:
- `VideoJpaSpringDataRepository`: add `findByOwnerTypeAndOwnerIdAndStatus(String, UUID, String)` query method
- `VideoRepositoryPort`: add domain port method
- `VideoController`: add `@GetMapping("/videos")` with `entityId` + `context` query params
- Security config: whitelist `/videos` GET as public (no auth for buyer-facing)
- Response mapping: `public_key` → `playbackUrl`, `poster_object_key` → `thumbnailUrl`

### 12.2 VideoStatus Enum Sync

**FE enum** (`fe/src/app/types/api/video.ts`):
```
PENDING, UPLOADING, TRANSCODING, MODERATING, PUBLISHED, REJECTED, FAILED
```

**Backend statuses** (from Kafka events + moderation flow):
```
UPLOADING, UPLOADED, TRANSCODED, TRANSCODING, MODERATING, PENDING_REVIEW, APPROVED, PUBLISHED, REJECTED, APPEAL_PENDING, FAILED, DELETED
```

**Missing from FE:** `UPLOADED`, `TRANSCODED`, `PENDING_REVIEW`, `APPROVED`, `APPEAL_PENDING`, `DELETED`

**Action:** Add missing statuses to `videoStatusSchema` in `fe/src/app/types/api/video.ts`. Update `VideoUploadProgress` stepper to handle `PENDING_REVIEW` state (between moderation and admin action).

### 12.3 VideoUploadProgress Bug Fix

Line 90 of `VideoUploadProgress.tsx` references `data?.rejectionReason` but only destructures `{ status, isStuck, isLoading }` from `useVideoStatus`. Must also destructure `data` from the hook return value.

### 12.4 VideoModerationPanel Wrapper

`VideoModerationPanel` does not exist — must be created as a new component wrapping `VideoModeration.tsx` and `VideoAppeals.tsx` with sub-tab state.

### 12.5 Notification Type Schema

Add to `notificationTypeSchema` Zod enum in `fe/src/app/types/api/notification.ts`:
```ts
// Current: 12 types (ORDER_CREATED through PAYOUT_COMPLETED)
// Add: "VIDEO_PUBLISHED", "VIDEO_REJECTED"
```

---

## 13. Open Decisions — RESOLVED

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| D1 | Video position in gallery | **First slide** | All competitors (Shopee/Lazada/Amazon) use first position. 40% click rate, 3.6x conversion lift. |
| D2 | Keep "Videos" tab? | **Show only when count > 0** | Hybrid: hero video in gallery + tab for multiple. No tab bloat for products without videos. |
| D3 | Allow upload in create mode? | **Queue for post-save** | Matches Shopee/Lazada. Single workflow, no context-switching. |
| D4 | Gallery state model | **Discriminated union `GalleryItem[]`** | Type-safe, extensible. Prevents render bugs in mixed-media gallery. |
| D5 | Gallery-to-player transition | **Inline replace with ✕ close** | Same container, `aspect-video` + `object-contain`, muted default, Escape/✕ to exit. |
