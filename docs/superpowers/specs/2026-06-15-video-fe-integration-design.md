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

**Gallery integration:**
- Video thumbnails (poster frames) appear as the LAST slides in the existing image carousel
- Each video thumbnail has a semi-transparent ▶ play icon overlay
- Clicking a video thumbnail replaces the main gallery area with the `VideoPlayer` component (inline playback)
- Thumbnail row shows video entries with a small film-strip icon to distinguish from photos

**Videos tab:**
- New 5th tab: `"videos"` added to `activeTab` union type (`"desc" | "specs" | "reviews" | "qa" | "videos"`)
- Tab label: "📹 Videos" (with count badge, e.g., "Videos (2)")
- Tab content: grid of `VideoPlayer` components for all PUBLISHED videos on this product
- Empty state: "No videos yet" with a subtle prompt "Be the first to add a video review"

**Data flow:**
- New hook: `useProductVideos(productId: string)` → calls `GET /api/v1/videos?ownerType=PRODUCT&ownerId={productId}&status=PUBLISHED`
- Returns `{ videos: Video[], isLoading: boolean }`
- Videos include: `videoId`, `src` (public URL), `poster` (poster URL), `durationSeconds`, `createdAt`

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

**Behavior:**
- Uses `useVideoUpload({ ownerType: "PRODUCT", ownerId: productId })`
- Shows `VideoUploadDropzone` when slots available (max 3 - existing count)
- Shows `VideoUploadProgress` for in-flight uploads (pipeline stepper)
- Shows existing videos with status badge + delete button (only PUBLISHED can be deleted by owner)
- `isBusy` gate: modal cannot be closed/submitted while upload is in flight
- Create mode: video upload is disabled until product is first saved (needs productId)

**Constraints:**
- Max 3 videos per product (enforced client-side + server-side)
- Max 500 MB per video
- Allowed formats: MP4, MOV, WebM, MKV

### 3.3 Review Video — Upload + Display

**CreateReviewForm (upload):**
- Below the photo attachment row, add a "Add video" button (film icon)
- Clicking opens the `VideoUploadDropzone` inline (collapsed by default)
- Max 1 video per review, max 200 MB
- Uses `useVideoUpload({ ownerType: "REVIEW", ownerId: reviewId })`
- After upload completes, show the `VideoUploadProgress` stepper until PUBLISHED
- Form submission is NOT blocked by video processing — the video appears in the review card asynchronously once moderation passes

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

**VideoModerationPanel:**
- Two sub-tabs: "Queue" (renders `VideoModeration.tsx`) and "Appeals" (renders `VideoAppeals.tsx`)
- Both components already exist and are tested (10 vitest tests pass)
- Just need to be imported and rendered

### 3.5 Notifications — Icon Map + Deep Links

**notification-type.enum (already done in backend):**
- `VIDEO_PUBLISHED` and `VIDEO_REJECTED` already exist in the notification-service

**FE notification-icon.tsx:**
- Add to `ICON_MAP`: `VIDEO_PUBLISHED → IconPlayerPlay` (green-500)
- Add to `ICON_MAP`: `VIDEO_REJECTED → IconPlayerStop` (red-500)

**Deep link routing (already handled by react-router):**
- `VIDEO_PUBLISHED` sends `deepLink: "/product/{productId}"` → buyer clicks → product page (video now in gallery)
- `VIDEO_REJECTED` sends `deepLink: "/seller"` → seller clicks → seller dashboard (where they manage products)

**FE notification type schema:**
- Add `VIDEO_PUBLISHED` and `VIDEO_REJECTED` to `notificationTypeSchema` Zod enum in `fe/src/app/types/api/notification.ts`

---

## 4. New API Endpoint

### GET /api/v1/videos

**Purpose:** Fetch published videos for a product or review (buyer-facing, public).

**Query params:**
- `ownerType` (required): `PRODUCT` | `REVIEW`
- `ownerId` (required): UUID of the product or review
- `status` (optional, default `PUBLISHED`): filter by status

**Response:**
```json
[
  {
    "videoId": "uuid",
    "src": "https://minio/vnshop-videos/products/{id}/videos/{uuid}_720p.mp4",
    "poster": "https://minio/vnshop-videos/products/{id}/videos/{uuid}_poster.jpg",
    "durationSeconds": 127.45,
    "createdAt": "2026-06-15T10:00:00Z"
  }
]
```

**Backend:** Simple JPA query on `videos` table filtered by `owner_type`, `owner_id`, `status`. Return `public_key` as `src`, `poster_object_key` as `poster`.

---

## 5. New Hooks

### useProductVideos(productId: string)
```ts
const { videos, isLoading } = useProductVideos(productId);
// Calls GET /api/v1/videos?ownerType=PRODUCT&ownerId={productId}
// Cache key: ["videos", "product", productId]
```

### useReviewVideo(reviewId: string)
```ts
const { video, isLoading } = useReviewVideo(reviewId);
// Calls GET /api/v1/videos?ownerType=REVIEW&ownerId={reviewId}
// Returns first (only) video or null
// Cache key: ["videos", "review", reviewId]
```

---

## 6. i18n Keys (en + vi)

```json
{
  "video.gallery.playOverlay": "Play video",
  "video.gallery.videoCount": "{{count}} video(s)",
  "video.tab.title": "Videos",
  "video.tab.empty": "No videos yet",
  "video.tab.emptyHint": "Be the first to add a video review!",
  "video.seller.sectionTitle": "Videos ({{count}}/{{max}})",
  "video.seller.createFirst": "Save the product first to upload videos",
  "video.seller.deleteConfirm": "Remove this video? This cannot be undone.",
  "video.review.addButton": "Add video",
  "video.review.processing": "Processing...",
  "video.review.maxSize": "Max 200 MB",
  "admin.nav.videoModeration": "Video Moderation",
  "admin.nav.videoAppeals": "Video Appeals"
}
```

Vietnamese translations follow the same structure with localized copy.

---

## 7. Accessibility

- Video thumbnails in gallery: `role="button"` + `aria-label="Play video: {title}"`
- VideoPlayer: native `<video>` controls (already accessible)
- Tab: `role="tab"` + `aria-selected` (follows existing tab pattern)
- Upload dropzone: `aria-label="Upload video"` + keyboard-activatable
- Admin moderation: focus management on approve/reject actions

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
| 1 | designer | Product gallery: video thumbnails as last carousel slides with ▶ overlay | `ProductPage.tsx` | Visual regression |
| 2 | executor | Product Videos tab: 5th tab, useProductVideos hook, VideoPlayer grid | `ProductPage.tsx`, new hook | vitest |
| 3 | executor | Seller modal: Videos section below images with upload + existing list | `seller-product-modal.tsx` | vitest |
| 4 | executor | Review upload: video button in CreateReviewForm | Review form component | vitest |
| 5 | executor | Review display: video in ReviewCard media row | ReviewCard component | vitest |
| 6 | executor | Admin sidebar: "Video Moderation" tab wiring | `AdminPage.tsx` | vitest |
| 7 | executor | Notification icons + deepLink types | `notification-icon.tsx`, `notification.ts` | vitest |
| 8 | executor | Backend: GET /api/v1/videos endpoint + FE hooks | Controller + hooks | mvn + vitest |
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
