# BA UX/UI Audit — VNShop Video FE Integration

**Date:** 2026-06-16
**Scope:** `fe/src/features/videos/` + integration points across buyer/seller/admin journeys
**Method:** 3 parallel Sonnet agents (one per persona) walked the full code path, cross-checked against the live running app via Playwright, and reviewed the i18n files. Every finding cites `file:line`.
**Personas:** Mai (buyer), Hùng (seller), Linh (admin). See [persona spec](../personas/video-customer-persona.md).

---

## TL;DR — Severity Counts

| Severity | Buyer (Mai) | Seller (Hùng) | Admin (Linh) | **Total** |
|----------|------------|---------------|--------------|-----------|
| P0 — Blocker | 4 | 3 | 2 | **9** |
| P1 — Major | 6 | 4 | 3 | **13** |
| P2 — Minor | 3 | 4 | 4 | **11** |
| P3 — Nit | 2 | 3 | 3 | **8** |
| **Total** | **15** | **14** | **12** | **41** |

**Cross-cutting observation (the dominant pattern):** **P0 i18n gaps are responsible for 6 of the 9 P0 findings.** The Video FE integration was shipped with React components calling `t("video.upload.dropzone.title")`, `t("admin.videoModeration.title")`, etc. — but the corresponding keys do not exist in `en.json` or `vi.json`. The running app renders **raw i18n keys as literal user-facing text** (e.g. `seller.productModal.videosLabel (0/3)`) on the seller modal. This is the single highest-impact issue and the easiest to fix in bulk.

---

## 🔴 P0 — Blockers (must fix before user-facing release)

### Cross-cutting: i18n key namespace gaps

#### P0-1: `video.upload.dropzone.*` — 10 keys missing
- **File:** `fe/src/features/videos/components/VideoUploadDropzone.tsx:65,97,98,106,122,152,156,158,160,161,169,184,197`
- **Persona:** Hùng
- **Heuristic:** Nielsen #1 (Visibility of System Status)
- **Reproduction:** Open the seller product modal → dropzone renders with empty strings for `ariaLabel`, `title`, `hint`, `errorTitle`, `tryAgain`, `unknownFile`, `complete`, `initiating`, `validating`, `uploading`, `cancelAria`, `progressAria`, `processingNote`.
- **Evidence:** `video.upload` key set is `[]` in both en.json and vi.json. Confirmed via Node.js parse.
- **Fix:** Add the full `video.upload` namespace (see Hùng audit P0 #1 for full JSON).

#### P0-2: `video.pipeline.uploading/transcoding/moderating/published/inProgress` — 5 keys missing
- **File:** `fe/src/features/videos/components/VideoUploadProgress.tsx:14-18`
- **Persona:** Hùng
- **Heuristic:** Nielsen #1 — user cannot distinguish UPLOADING from TRANSCODING from MODERATING
- **Evidence:** `video.pipeline` namespace has only 7 keys; the 4 step labels and `inProgress` are missing. The stepper renders raw key strings.
- **Fix:** Add `uploading: "Uploading"`, `transcoding: "Converting"`, `moderating: "Under review"`, `published: "Live"`, `inProgress: "In progress"` (and Vietnamese equivalents).

#### P0-3: `seller.productModal.videosLabel / videoDeleted / videoDeleteErr / removeVideo / videoCreateHint` — 5 keys missing
- **File:** `fe/src/app/components/seller-product-modal.tsx:467,506,508,511,545`
- **Persona:** Hùng
- **Evidence:** Confirmed: `seller.productModal` namespace has 37 keys, none are video-related. The Videos section header shows `seller.productModal.videosLabel (0/3)` — visible in [screenshot 06](fe/e2e/evidence/video-integration/screenshots/06-seller-modal-videos-section.png).
- **Fix:** Add the 5 keys (see Hùng audit P0 #3).

#### P0-4: `admin.videoModeration.*` and `admin.videoAppeals.*` — ~30 keys missing
- **File:** `fe/src/app/lib/i18n/en.json` and `vi.json` (entire namespaces absent)
- **Persona:** Linh
- **Heuristic:** Nielsen #1 + #10
- **Reproduction:** `t("admin.videoModeration.title")` at `VideoModeration.tsx:432` — entire panel header, all buttons, toasts, reject dialog, empty state, loading state all render as bare key strings. Confirmed visually in [screenshot 03](fe/e2e/evidence/video-integration/screenshots/03-admin-video-moderation-panel-rendered.png).
- **Fix:** Add the full namespace trees (see Linh audit P0 #1 for full JSON with all 30+ keys).

#### P0-5: `VIDEO_PUBLISHED` and `VIDEO_REJECTED` absent from `notifications.preferences.types`
- **File:** `fe/src/app/lib/i18n/en.json:1184-1197` and `vi.json:1184-1197`
- **Persona:** Linh + all users
- **Heuristic:** Nielsen #1 + #8 (Minimalist Design) — users cannot manage their video notification preferences
- **Fix:** Add both types to `notifications.preferences.types` in both files.

### Buyer-only P0

#### P0-6: `VideoPlayer` has no `onError` handler — silent video failure
- **File:** `fe/src/features/videos/components/VideoPlayer.tsx:82-90`
- **Persona:** Mai
- **Heuristic:** Nielsen #1 — silent failure on stale signed URLs
- **Evidence:** No `onError` handler on the `<video>` element. The poster image remains on screen with no error indication. Mai assumes the product has no video and bounces.
- **Fix:** Add `onError={() => { setError(true); setBuffering(false); }}` plus a visible error overlay with `role="alert"`.

#### P0-7: `VideoPlayer` has no audio-stop on unmount
- **File:** `fe/src/features/videos/components/VideoPlayer.tsx:43-90`
- **Persona:** Mai
- **Heuristic:** Nielsen #3 — Mai's documented #3 complaint
- **Evidence:** No `useEffect` cleanup. After navigating away, the `<video>` element is unmounted but `play()` continues.
- **Fix:**
  ```tsx
  useEffect(() => {
    return () => {
      videoRef.current?.pause();
      videoRef.current.src = "";
    };
  }, []);
  ```

#### P0-8: `useProductVideos` and `useReviewVideo` expose no `isError`
- **File:** `fe/src/features/videos/hooks/useProductVideos.ts:16` and `useReviewVideo.ts:16`
- **Persona:** Mai
- **Heuristic:** Nielsen #1 — failed API is indistinguishable from "no videos"
- **Fix:** Return `isError` from both hooks. ProductPage should branch on `isError` to show a retry button.

#### P0-9: Videos tab in ProductPage has no loading skeleton
- **File:** `fe/src/app/pages/ProductPage.tsx:490-500`
- **Persona:** Mai
- **Heuristic:** Nielsen #1 — empty state and loading state are visually identical
- **Fix:** Add `if (isProductVideosLoading) return <VideoPlayerSkeleton />` branch.

---

## 🟠 P1 — Major (must fix before scaling)

### Buyer (Mai)

#### P1-1: Gallery close button is 28px — below WCAG 2.5.5 minimum (44px)
- **File:** `fe/src/app/pages/ProductPage.tsx:216-222`
- **Fix:** Change `p-1.5` to `p-2.5` (36px) minimum, `p-3` preferred. Add `focus-visible:outline focus-visible:outline-2 focus-visible:outline-white`.

#### P1-2: No caption track infrastructure in `VideoPlayer`
- **File:** `fe/src/features/videos/components/VideoPlayer.tsx:82`
- **Heuristic:** WCAG 1.2.2 (Captions, Prerecorded) — AA required
- **Fix:** Add `tracks` prop and render `<track kind="captions" ...>` inside `<video>`.

#### P1-3: Gallery close button has no keyboard focus indicator
- **File:** `fe/src/app/pages/ProductPage.tsx:216-222`
- **Heuristic:** WCAG 2.4.7 (Focus Visible)
- **Fix:** Add `focus-visible:outline focus-visible:outline-2 focus-visible:outline-white`.

#### P1-4: Review video thumbnail is 64px — nearly unusable on mobile
- **File:** `fe/src/features/videos/components/ReviewVideoDisplay.tsx:22-30`
- **Heuristic:** Nielsen #8 (Minimalist Design) + #6 (Recognition)
- **Fix:** Increase to `w-24 h-24` (96px) minimum. Add `aria-label` to container.

#### P1-5: "Processing" state in `ReviewVideoDisplay` is a 10px text in a 64px box
- **File:** `fe/src/features/videos/components/ReviewVideoDisplay.tsx:31-37`
- **Heuristic:** Nielsen #1 — text is unreadable
- **Fix:** Use a spinner icon with `aria-live="polite"`, or render the badge outside the thumbnail.

#### P1-6: Videos tab renders video players with no identifying title or sequence
- **File:** `fe/src/app/pages/ProductPage.tsx:493-499`
- **Heuristic:** Nielsen #6 — 3 identical players with no labels
- **Fix:** Pass `title={t("video.tab.videoLabel", { index: i + 1, total })}`. Show "Video 1 of 3" above each player.

#### P1-7: `ReviewVideoDisplay` silently returns `null` for `REJECTED`/`FAILED`
- **File:** `fe/src/features/videos/components/ReviewVideoDisplay.tsx:33-37`
- **Heuristic:** Nielsen #1
- **Fix:** Show a small "Video unavailable" icon with `aria-label`.

### Seller (Hùng)

#### P1-8: Dropzone has no focus ring
- **File:** `fe/src/features/videos/components/VideoUploadDropzone.tsx:64-90`
- **Heuristic:** WCAG 2.4.7 — Hùng is keyboard-only
- **Fix:** Add `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2` to the className array.

#### P1-9: No `aria-live` region announces upload progress
- **File:** `fe/src/features/videos/components/VideoUploadDropzone.tsx:175-185` and `VideoUploadProgress.tsx` (whole file)
- **Heuristic:** WCAG 1.3.1 + Nielsen #1
- **Fix:** Wrap status text in `<span aria-live="polite">`. Add live region to `VideoUploadProgress` stepper.

#### P1-10: Cancel button on dropzone is 28px (W-7 H-7)
- **File:** `fe/src/features/videos/components/VideoUploadDropzone.tsx:169`
- **Heuristic:** WCAG 2.5.5 (Target Size, Minimum 44px)
- **Fix:** Change `w-7 h-7` to `w-11 h-11`.

#### P1-11: At 0% progress the bar is zero-width (invisible)
- **File:** `fe/src/features/videos/components/VideoUploadDropzone.tsx:175-185`
- **Heuristic:** Nielsen #1 — Hùng sees blank bar and cannot tell "not started" from "uploading at 0%"
- **Fix:** Start at `min-width: 4px` OR add a spinner during `initiating` phase.

### Admin (Linh)

#### P1-12: VideoModerationPanel tab list lacks keyboard arrow-key navigation + `aria-controls`
- **File:** `fe/src/app/pages/admin/VideoModerationPanel.tsx:15-40`
- **Heuristic:** WCAG 2.1.1 (Keyboard) + Nielsen #4
- **Fix:** Implement roving tabindex (`tabIndex={active ? 0 : -1}`), add `onKeyDown` for ArrowLeft/ArrowRight, add `aria-controls` pointing to panel `id`s. Systemic — `PayoutsQueue.tsx:170-189` has the same issue.

#### P1-13: Appeals sub-tab has no pending-count badge in the sidebar nav
- **File:** `fe/src/app/pages/admin/AdminPage.tsx:76-102`
- **Heuristic:** Nielsen #1 + #6
- **Evidence:** `badges` object has `sellers`, `reviews`, `disputes`, `payouts` but no `appeals`. Linh has no glanceable awareness of the appeals backlog.
- **Fix:** Add `videoAppealsQuery` count, include in badges object, render as sidebar badge.

#### P1-14: Appeals tab refetches on every visit — no `staleTime` (Linh's #1 complaint)
- **File:** `fe/src/app/hooks/use-admin-video-moderation.ts:88-94`
- **Heuristic:** Nielsen #1
- **Evidence:** `staleTime` defaults to 0. Every focus event refetches. Contrast with `useVideoPreview` which correctly sets `staleTime: 1000 * 60 * 4`.
- **Fix:** Add `staleTime: 1000 * 60 * 5` to `useVideoAppeals`.

---

## 🟡 P2 — Minor (documented, not blocking)

| # | Persona | File | Issue |
|---|---------|------|-------|
| P2-1 | Mai | `ProductPage.tsx:265-277` | `aria-label` on gallery video thumbs has no index ("Play video" vs "View image 2") |
| P2-2 | Mai | `ProductPage.tsx:216-222` | No focus management when gallery video player closes (focus lost to body) |
| P2-3 | Mai | `ProductPage.tsx:409-420` | No `aria-live` on tabpanel for "Videos tab, 3 videos available" |
| P2-4 | Hùng | `VideoUploadDropzone.tsx:90-122` | No retry path for failed upload — "Try again" calls reset, not re-upload |
| P2-5 | Hùng | `seller-product-modal.tsx:148` | `video.upload.cancelConfirm` key missing — modal close prompt shows raw key |
| P2-6 | Hùng | `seller-product-modal.tsx:526-531` | Modal-level cancel button has no minimum touch target |
| P2-7 | Hùng | `seller-product-modal.tsx:487-498` | Status badge shows raw enum value `PUBLISHED` instead of translated label |
| P2-8 | Linh | `VideoModeration.tsx:393-412` | Reject dialog does not warn that the action is irreversible |
| P2-9 | Linh | `NotificationsPage.tsx:35-49` | `TYPE_ICON` map missing `VIDEO_PUBLISHED` / `VIDEO_REJECTED` — falls to default Bell icon |
| P2-10 | Linh | `VideoAppeals.tsx:281-283` | Plain text loading state (no skeleton) |
| P2-11 | Linh | `VideoAppeals.tsx:279` | No count badge next to Appeals tab title |

---

## ⚪ P3 — Nits

| # | Persona | File | Issue |
|---|---------|------|-------|
| P3-1 | Mai | `useProductVideos.ts:16` | Does not export `isError` (downstream of P0-8) |
| P3-2 | Mai | `VideoPlayer.tsx:98-104` | Buffering spinner lacks `role="status"` (some screen readers) |
| P3-3 | Hùng | `seller-product-modal.tsx:436` | Hardcoded `#00BFB3` color, should use `border-primary` token |
| P3-4 | Hùng | `VideoUploadDropzone.tsx:77` | Drag-over `bg-primary/5` inconsistent with hover `bg-surface-elevated` |
| P3-5 | Hùng | `VideoUploadProgress.tsx:102-105` | Dead `isLoading` ternary — both branches render identical spinner |
| P3-6 | Linh | `VideoModerationPanel.tsx:16-39` | Both tabs visually identical — no count differentiation |
| P3-7 | Linh | `VideoModeration.tsx:449-451` | Plain text loading (no skeleton) — design system gap |
| P3-8 | Linh | `notification-bell.tsx:200-201` | No i18n key for video notification copy in bell dropdown |

---

## Top 10 Most Damaging (cross-persona)

| Rank | Finding | Persona | Heuristic |
|------|---------|---------|-----------|
| 1 | **All `video.upload.dropzone.*` i18n keys missing** | Hùng | Nielsen #1 |
| 2 | **`admin.videoModeration.*` and `admin.videoAppeals.*` i18n keys missing** | Linh | Nielsen #1 + #10 |
| 3 | **No `onError` handler + no audio stop on unmount in `VideoPlayer`** | Mai | Nielsen #1 + #3 |
| 4 | **No `isError` exposed from `useProductVideos` / `useReviewVideo`** | Mai | Nielsen #1 |
| 5 | **`VIDEO_PUBLISHED` / `VIDEO_REJECTED` missing from notification preferences** | Linh + all | Nielsen #1 + #8 |
| 6 | **Pipeline step labels missing — UPLOADING/TRANSCODING/MODERATING/PUBLISHED all render as raw keys** | Hùng | Nielsen #1 |
| 7 | **Review video thumbnail is 64px — nearly unusable on mobile** | Mai | Nielsen #8 + #6 |
| 8 | **No focus ring on dropzone + 28px cancel button — keyboard journey broken** | Hùng | WCAG 2.4.7 + 2.5.5 |
| 9 | **Appeals tab refetches on every visit (Linh's #1 complaint)** | Linh | Nielsen #1 |
| 10 | **`seller.productModal.videosLabel` and 4 sibling keys missing** | Hùng | Nielsen #1 + #2 |

---

## Design System Gaps

These are the systemic patterns the BA agents found. Fixing these prevents future regressions of the same shape:

1. **No skeleton loader component in the design system.** Multiple loading states across the video journey use plain text or no indicator. Build `<VideoPlayerSkeleton>`, `<UploadProgressSkeleton>`, `<AppealRowSkeleton>` and centralize.
2. **No touch-target size enforcement.** Multiple buttons (28px close, 20px cancel) ship below WCAG 2.5.5 minimum. Add an ESLint rule or token (`min-h-touch: 44px`) to enforce.
3. **Hardcoded colors still present in the modal** (`#00BFB3`). The rest of the codebase migrated to tokens; this one file didn't.
4. **`staleTime` defaults left at 0 for several video hooks.** Pattern: hooks that fetch video lists should default to 5 minutes minimum.
5. **No `aria-live` regions in upload progress components.** Build a `<StatusAnnouncer>` pattern or wrapper.

---

## Accessibility Coverage

- **WCAG 2.1 Level A:** 6 violations (keyboard nav, focus management, name/role/value)
- **WCAG 2.1 Level AA:** 7 violations (focus visible, target size, captions, contrast on play overlay, touch target minimum, error identification)
- **WCAG 2.1 Level AAA:** 1 violation (no captions — AAA would require them for all video; AA only for prerecorded)

The video integration is **not** at WCAG 2.1 AA conformance today. None of the Level A or AA issues are P0-blockers individually, but in aggregate they make the feature inaccessible to keyboard users, screen reader users, and touch users on small viewports.

---

## Persona-specific "Did we actually deliver?" verdict

| Persona | Verdict | Why |
|---------|---------|-----|
| **Mai (buyer)** | ❌ Partial — works, but video failure is silent, audio outlives navigation, and review videos are 64px | Core value prop (watching videos before buying) is undermined by the small review thumb and silent error states |
| **Hùng (seller)** | ❌ Not really — every label is a raw i18n key, no focus ring, 28px cancel button | The entire upload UI is functionally broken for any non-English-speaking user |
| **Linh (admin)** | ❌ Not really — every label is a raw i18n key, Appeals tab re-fetches every visit, no keyboard nav | The moderation panel renders literally `admin.videoModeration.title` in the header — not fit for production |

**Bottom line:** the code compiles, the unit tests pass, and the E2E spec runs green. But **it does not actually deliver the UI/UX we promised**. The dominant failure is the missing i18n namespace — the FE renders raw keys as user-facing text. Fix P0-1 through P0-5 (all in `en.json` / `vi.json`) and the buyer/seller/admin surfaces will look 80% finished in a single afternoon.
