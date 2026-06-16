# Video FE Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire all existing video pipeline components (upload, player, moderation) into the actual UI pages so sellers can upload, buyers can watch, and admins can moderate.

**Architecture:** Thin integration layer. Most components exist (`VideoPlayer`, `VideoUploadDropzone`, `VideoUploadProgress`, `useVideoUpload`, `useVideoStatus`). Build 2 new hooks (`useProductVideos`, `useReviewVideo`), 1 backend endpoint (`GET /videos`), 1 wrapper component (`VideoModerationPanel`), and wire everything into existing pages. Discriminated union `GalleryItem[]` for mixed media gallery.

**Tech Stack:** React 18, TanStack Query, Zod, tus-js-client, Tailwind CSS, @tabler/icons-react, vitest, Spring Boot (backend)

---

## File Map

### New Files
| Path | Responsibility |
|------|---------------|
| `fe/src/features/videos/hooks/useProductVideos.ts` | Fetch published videos for a product |
| `fe/src/features/videos/hooks/useReviewVideo.ts` | Fetch single video for a review |
| `fe/src/features/videos/hooks/useProductVideos.test.ts` | Tests for useProductVideos |
| `fe/src/features/videos/hooks/useReviewVideo.test.ts` | Tests for useReviewVideo |
| `fe/src/app/pages/admin/VideoModerationPanel.tsx` | Wrapper with sub-tabs for Queue + Appeals |
| `fe/src/app/pages/admin/VideoModerationPanel.test.tsx` | Tests for the panel |
| `services/product-service/src/main/java/com/vnshop/productservice/infrastructure/web/video/VideoListController.java` | Public GET /videos endpoint |
| `services/product-service/src/test/java/com/vnshop/productservice/infrastructure/web/video/VideoListControllerTest.java` | Integration test |

### Modified Files
| Path | Change |
|------|--------|
| `fe/src/app/types/api/video.ts` | Add missing VideoStatus enum values |
| `fe/src/app/types/api/notification.ts` | Add VIDEO_PUBLISHED, VIDEO_REJECTED |
| `fe/src/app/components/notifications/notification-icon.tsx` | Add icon + color entries |
| `fe/src/features/videos/components/VideoUploadProgress.tsx` | Fix `data` destructuring bug |
| `fe/src/features/videos/index.ts` | Re-export new hooks |
| `fe/src/app/pages/ProductPage.tsx` | Gallery refactor + Videos tab |
| `fe/src/app/components/seller-product-modal.tsx` | Video upload section |
| `fe/src/app/pages/admin/AdminPage.tsx` | Add videoModeration tab |
| `fe/src/app/lib/i18n/en.json` | Add new video keys |
| `fe/src/app/lib/i18n/vi.json` | Add new video keys (Vietnamese) |
| `services/product-service/src/main/java/.../persistence/video/VideoJpaSpringDataRepository.java` | Add query method |

---

## Task 1: Prerequisites — Enum Sync + Bug Fix

**Files:**
- Modify: `fe/src/app/types/api/video.ts:1-15`
- Modify: `fe/src/features/videos/components/VideoUploadProgress.tsx:~line 10`

- [ ] **Step 1: Extend VideoStatus enum**

In `fe/src/app/types/api/video.ts`, update `videoStatusSchema`:

```ts
export const videoStatusSchema = z.enum([
  "PENDING",
  "UPLOADING",
  "UPLOADED",
  "TRANSCODING",
  "TRANSCODED",
  "MODERATING",
  "PENDING_REVIEW",
  "APPROVED",
  "PUBLISHED",
  "REJECTED",
  "APPEAL_PENDING",
  "FAILED",
  "DELETED",
]);
```

- [ ] **Step 2: Fix VideoUploadProgress data destructuring**

In `fe/src/features/videos/components/VideoUploadProgress.tsx`, find the `useVideoStatus` destructuring line and add `data`:

```ts
// Before:
const { status, isStuck, isLoading } = useVideoStatus(videoId, { enabled: !!videoId });

// After:
const { status, data, isStuck, isLoading } = useVideoStatus(videoId, { enabled: !!videoId });
```

- [ ] **Step 3: Run existing video tests to verify no regressions**

Run: `cd fe && npx vitest run src/features/videos/ --reporter=verbose`
Expected: All existing tests pass (VideoPlayer, useVideoUpload)

- [ ] **Step 4: Commit**

```bash
git add fe/src/app/types/api/video.ts fe/src/features/videos/components/VideoUploadProgress.tsx
git commit -m "fix(video): sync VideoStatus enum with backend + fix data destructuring bug"
```

---

## Task 2: Notification Types + Icons

**Files:**
- Modify: `fe/src/app/types/api/notification.ts:5-18`
- Modify: `fe/src/app/components/notifications/notification-icon.tsx:22-43`

- [ ] **Step 1: Add VIDEO types to notification schema**

In `fe/src/app/types/api/notification.ts`, add to the enum array:

```ts
export const notificationTypeSchema = z.enum([
  "ORDER_CREATED",
  "ORDER_CANCELLED",
  "ORDER_SHIPPED",
  "ORDER_DELIVERED",
  "PAYMENT_COMPLETED",
  "PAYMENT_REFUNDED",
  "SELLER_NEW_ORDER",
  "PRODUCT_APPROVED",
  "PRODUCT_REJECTED",
  "REVIEW_REPLIED",
  "RETURN_REQUESTED",
  "PAYOUT_COMPLETED",
  "VIDEO_PUBLISHED",
  "VIDEO_REJECTED",
]);
```

- [ ] **Step 2: Add icons and colors**

In `fe/src/app/components/notifications/notification-icon.tsx`:

Add import:
```ts
import { IconPlayerPlay, IconPlayerStop } from "@tabler/icons-react";
```

Add to `ICON_MAP`:
```ts
  VIDEO_PUBLISHED: IconPlayerPlay,
  VIDEO_REJECTED: IconPlayerStop,
```

Add to `COLOR_MAP`:
```ts
  VIDEO_PUBLISHED: "text-green-500",
  VIDEO_REJECTED: "text-red-500",
```

- [ ] **Step 3: Run notification tests**

Run: `cd fe && npx vitest run src/app/components/notifications/ --reporter=verbose`
Expected: PASS (type-checks cover the Record completeness)

- [ ] **Step 4: Commit**

```bash
git add fe/src/app/types/api/notification.ts fe/src/app/components/notifications/notification-icon.tsx
git commit -m "feat(notifications): add VIDEO_PUBLISHED and VIDEO_REJECTED types with icons"
```

---

## Task 3: Backend — GET /videos Endpoint

**Files:**
- Modify: `services/product-service/src/main/java/com/vnshop/productservice/infrastructure/persistence/video/VideoJpaSpringDataRepository.java`
- Create: `services/product-service/src/main/java/com/vnshop/productservice/infrastructure/web/video/VideoListController.java`
- Create: `services/product-service/src/test/java/com/vnshop/productservice/infrastructure/web/video/VideoListControllerTest.java`

- [ ] **Step 1: Add repository query method**

In `VideoJpaSpringDataRepository.java`, add:

```java
import java.util.List;
import java.util.UUID;

// Add to the interface:
List<VideoJpaEntity> findByOwnerTypeAndOwnerIdAndStatusOrderByCreatedAtDesc(
    String ownerType, UUID ownerId, String status);
```

- [ ] **Step 2: Write the controller test (TDD)**

Create `VideoListControllerTest.java`:

```java
package com.vnshop.productservice.infrastructure.web.video;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class VideoListControllerTest {

    @Autowired private MockMvc mvc;

    @Test
    void returns_empty_list_when_no_videos() throws Exception {
        mvc.perform(get("/videos")
                .param("entityId", "00000000-0000-0000-0000-000000000001")
                .param("context", "PRODUCT"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.videos").isArray())
            .andExpect(jsonPath("$.videos").isEmpty());
    }

    @Test
    void rejects_missing_params() throws Exception {
        mvc.perform(get("/videos"))
            .andExpect(status().isBadRequest());
    }
}
```

- [ ] **Step 3: Run test — verify it fails**

Run: `cd services/product-service && ./mvnw test -Dtest=VideoListControllerTest -pl .`
Expected: FAIL (endpoint doesn't exist yet)

- [ ] **Step 4: Implement the controller**

Create `VideoListController.java`:

```java
package com.vnshop.productservice.infrastructure.web.video;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.vnshop.productservice.infrastructure.persistence.video.VideoJpaEntity;
import com.vnshop.productservice.infrastructure.persistence.video.VideoJpaSpringDataRepository;

@RestController
public class VideoListController {

    private final VideoJpaSpringDataRepository videoRepo;

    public VideoListController(VideoJpaSpringDataRepository videoRepo) {
        this.videoRepo = videoRepo;
    }

    @GetMapping("/videos")
    public ResponseEntity<Map<String, Object>> listVideos(
            @RequestParam String entityId,
            @RequestParam String context) {

        String ownerType = context.toUpperCase();
        UUID ownerId = UUID.fromString(entityId);

        List<VideoJpaEntity> entities = videoRepo
            .findByOwnerTypeAndOwnerIdAndStatusOrderByCreatedAtDesc(ownerType, ownerId, "PUBLISHED");

        List<Map<String, Object>> videos = entities.stream().map(e -> Map.<String, Object>of(
            "id", e.getId().toString(),
            "entityId", e.getOwnerId().toString(),
            "context", e.getOwnerType(),
            "status", e.getStatus(),
            "playbackUrl", e.getPublicKey() != null ? e.getPublicKey() : "",
            "thumbnailUrl", e.getPosterObjectKey() != null ? e.getPosterObjectKey() : "",
            "durationSeconds", e.getDurationSeconds() != null ? e.getDurationSeconds() : 0,
            "uploadedAt", e.getCreatedAt() != null ? e.getCreatedAt().toString() : "",
            "publishedAt", e.getPublishedAt() != null ? e.getPublishedAt().toString() : ""
        )).toList();

        return ResponseEntity.ok(Map.of("videos", videos));
    }
}
```

- [ ] **Step 5: Whitelist the endpoint in security config**

Find the security config file (`SecurityConfig.java` or `WebSecurityConfig.java`) and add `/videos` GET to the public endpoints list:

```java
.requestMatchers(HttpMethod.GET, "/videos").permitAll()
```

- [ ] **Step 6: Run test — verify it passes**

Run: `cd services/product-service && ./mvnw test -Dtest=VideoListControllerTest -pl .`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add services/product-service/
git commit -m "feat(backend): add public GET /videos endpoint for product/review video listing"
```

---

## Task 4: FE Hooks — useProductVideos + useReviewVideo

**Files:**
- Create: `fe/src/features/videos/hooks/useProductVideos.ts`
- Create: `fe/src/features/videos/hooks/useReviewVideo.ts`
- Create: `fe/src/features/videos/hooks/useProductVideos.test.ts`
- Create: `fe/src/features/videos/hooks/useReviewVideo.test.ts`
- Modify: `fe/src/features/videos/index.ts`

- [ ] **Step 1: Write test for useProductVideos**

Create `fe/src/features/videos/hooks/useProductVideos.test.ts`:

```ts
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { server } from "../../../../test/msw-server";
import { createQueryWrapper } from "../../../../test/query-wrapper";
import { useProductVideos } from "./useProductVideos";

describe("useProductVideos", () => {
  it("returns videos for a product", async () => {
    server.use(
      http.get("*/videos", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("entityId")).toBe("product-1");
        expect(url.searchParams.get("context")).toBe("PRODUCT");
        return HttpResponse.json({
          videos: [
            {
              id: "vid-1",
              entityId: "product-1",
              context: "PRODUCT",
              status: "PUBLISHED",
              playbackUrl: "https://cdn/video.mp4",
              thumbnailUrl: "https://cdn/poster.jpg",
              durationSeconds: 45,
              uploadedAt: "2026-06-15T10:00:00Z",
              publishedAt: "2026-06-15T10:05:00Z",
            },
          ],
        });
      }),
    );

    const { result } = renderHook(() => useProductVideos("product-1"), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.videos).toHaveLength(1);
    expect(result.current.videos[0].playbackUrl).toBe("https://cdn/video.mp4");
  });

  it("returns empty array when no videos", async () => {
    server.use(
      http.get("*/videos", () => HttpResponse.json({ videos: [] })),
    );

    const { result } = renderHook(() => useProductVideos("product-2"), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.videos).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `cd fe && npx vitest run src/features/videos/hooks/useProductVideos.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement useProductVideos**

Create `fe/src/features/videos/hooks/useProductVideos.ts`:

```ts
import { useQuery } from "@tanstack/react-query";

import { videosByEntity } from "../../../app/lib/api/endpoints/videos";
import type { Video } from "../../../app/types/api/video";

export function useProductVideos(productId: string) {
  const { data, isLoading } = useQuery({
    queryKey: ["videos", "product", productId],
    queryFn: () => videosByEntity(productId, "PRODUCT"),
    enabled: !!productId,
  });

  const videos: Video[] = data?.videos ?? [];

  return { videos, isLoading };
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `cd fe && npx vitest run src/features/videos/hooks/useProductVideos.test.ts`
Expected: PASS

- [ ] **Step 5: Write test for useReviewVideo**

Create `fe/src/features/videos/hooks/useReviewVideo.test.ts`:

```ts
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { server } from "../../../../test/msw-server";
import { createQueryWrapper } from "../../../../test/query-wrapper";
import { useReviewVideo } from "./useReviewVideo";

describe("useReviewVideo", () => {
  it("returns single video for a review", async () => {
    server.use(
      http.get("*/videos", () =>
        HttpResponse.json({
          videos: [
            {
              id: "vid-r1",
              entityId: "review-1",
              context: "REVIEW",
              status: "PUBLISHED",
              playbackUrl: "https://cdn/review-video.mp4",
              thumbnailUrl: "https://cdn/review-poster.jpg",
              durationSeconds: 30,
              uploadedAt: "2026-06-15T10:00:00Z",
              publishedAt: "2026-06-15T10:05:00Z",
            },
          ],
        }),
      ),
    );

    const { result } = renderHook(() => useReviewVideo("review-1"), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.video).not.toBeNull();
    expect(result.current.video?.playbackUrl).toBe("https://cdn/review-video.mp4");
  });

  it("returns null when no video attached", async () => {
    server.use(
      http.get("*/videos", () => HttpResponse.json({ videos: [] })),
    );

    const { result } = renderHook(() => useReviewVideo("review-2"), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.video).toBeNull();
  });
});
```

- [ ] **Step 6: Implement useReviewVideo**

Create `fe/src/features/videos/hooks/useReviewVideo.ts`:

```ts
import { useQuery } from "@tanstack/react-query";

import { videosByEntity } from "../../../app/lib/api/endpoints/videos";
import type { Video } from "../../../app/types/api/video";

export function useReviewVideo(reviewId: string) {
  const { data, isLoading } = useQuery({
    queryKey: ["videos", "review", reviewId],
    queryFn: () => videosByEntity(reviewId, "REVIEW"),
    enabled: !!reviewId,
  });

  const video: Video | null = data?.videos?.[0] ?? null;

  return { video, isLoading };
}
```

- [ ] **Step 7: Run test — verify it passes**

Run: `cd fe && npx vitest run src/features/videos/hooks/useReviewVideo.test.ts`
Expected: PASS

- [ ] **Step 8: Update barrel export**

In `fe/src/features/videos/index.ts`, add:

```ts
export { useProductVideos } from "./hooks/useProductVideos";
export { useReviewVideo } from "./hooks/useReviewVideo";
```

- [ ] **Step 9: Commit**

```bash
git add fe/src/features/videos/
git commit -m "feat(video): add useProductVideos and useReviewVideo hooks with tests"
```

---

## Task 5: Admin — VideoModerationPanel + Sidebar Wiring

**Files:**
- Create: `fe/src/app/pages/admin/VideoModerationPanel.tsx`
- Create: `fe/src/app/pages/admin/VideoModerationPanel.test.tsx`
- Modify: `fe/src/app/pages/admin/AdminPage.tsx:25-45,154-176`

- [ ] **Step 1: Write test for VideoModerationPanel**

Create `fe/src/app/pages/admin/VideoModerationPanel.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { VideoModerationPanel } from "./VideoModerationPanel";

// Mock the heavy child components
vi.mock("./VideoModeration", () => ({ VideoModeration: () => <div data-testid="queue" /> }));
vi.mock("./VideoAppeals", () => ({ VideoAppeals: () => <div data-testid="appeals" /> }));

describe("VideoModerationPanel", () => {
  it("renders Queue tab by default", () => {
    render(<VideoModerationPanel />);
    expect(screen.getByTestId("queue")).toBeInTheDocument();
    expect(screen.queryByTestId("appeals")).not.toBeInTheDocument();
  });

  it("switches to Appeals tab on click", () => {
    render(<VideoModerationPanel />);
    fireEvent.click(screen.getByRole("tab", { name: /appeals/i }));
    expect(screen.getByTestId("appeals")).toBeInTheDocument();
    expect(screen.queryByTestId("queue")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `cd fe && npx vitest run src/app/pages/admin/VideoModerationPanel.test.tsx`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement VideoModerationPanel**

Create `fe/src/app/pages/admin/VideoModerationPanel.tsx`:

```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { VideoModeration } from "./VideoModeration";
import { VideoAppeals } from "./VideoAppeals";

type SubTab = "queue" | "appeals";

export function VideoModerationPanel() {
  const { t } = useTranslation();
  const [subTab, setSubTab] = useState<SubTab>("queue");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-border" role="tablist">
        <button
          role="tab"
          aria-selected={subTab === "queue"}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            subTab === "queue"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setSubTab("queue")}
        >
          {t("admin.nav.videoModeration")}
        </button>
        <button
          role="tab"
          aria-selected={subTab === "appeals"}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            subTab === "appeals"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setSubTab("appeals")}
        >
          {t("admin.nav.videoAppeals")}
        </button>
      </div>

      {subTab === "queue" ? <VideoModeration /> : <VideoAppeals />}
    </div>
  );
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `cd fe && npx vitest run src/app/pages/admin/VideoModerationPanel.test.tsx`
Expected: PASS

- [ ] **Step 5: Wire into AdminPage**

In `fe/src/app/pages/admin/AdminPage.tsx`:

Add to `AdminTab` type:
```ts
type AdminTab =
  | "dashboard"
  | "sellers"
  | "reviews"
  | "coupons"
  | "disputes"
  | "payouts"
  | "users"
  | "orders"
  | "health"
  | "videoModeration";
```

Add to `NAV_ITEMS` array (after "reviews"):
```ts
  { id: "videoModeration", labelKey: "admin.nav.videoModeration", icon: IconVideo },
```

Add import at top:
```ts
import { IconVideo } from "@tabler/icons-react";
import { VideoModerationPanel } from "./VideoModerationPanel";
```

Add conditional render after the `health` line:
```tsx
{activeTab === "videoModeration" ? <VideoModerationPanel /> : null}
```

- [ ] **Step 6: Run admin page tests**

Run: `cd fe && npx vitest run src/app/pages/admin/ --reporter=verbose`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add fe/src/app/pages/admin/
git commit -m "feat(admin): add Video Moderation tab with Queue + Appeals sub-panels"
```

---

## Task 6: i18n Keys

**Files:**
- Modify: `fe/src/app/lib/i18n/en.json`
- Modify: `fe/src/app/lib/i18n/vi.json`

- [ ] **Step 1: Add English keys**

Add to `fe/src/app/lib/i18n/en.json` under the `"video"` section:

```json
"video": {
  ...existing keys...,
  "gallery": {
    "playOverlay": "Play video",
    "videoCount": "{{count}} video(s)",
    "closePlayer": "Close video player"
  },
  "tab": {
    "title": "Videos",
    "empty": "No videos available"
  },
  "seller": {
    "sectionTitle": "Videos ({{count}}/{{max}})",
    "createFirst": "Videos will upload after you save the product",
    "deleteConfirm": "Remove this video? This cannot be undone.",
    "cancelUpload": "Cancel upload?",
    "durationLimit": "Max {{seconds}} seconds"
  },
  "review": {
    "addButton": "Add video",
    "processing": "Processing...",
    "maxSize": "Max 200 MB",
    "durationLimit": "Max 60 seconds"
  }
}
```

Add to `"admin"` section:
```json
"admin": {
  ...existing keys...,
  "nav": {
    ...existing keys...,
    "videoModeration": "Video Moderation",
    "videoAppeals": "Video Appeals"
  }
}
```

- [ ] **Step 2: Add Vietnamese keys**

Add to `fe/src/app/lib/i18n/vi.json` under the `"video"` section:

```json
"video": {
  ...existing keys...,
  "gallery": {
    "playOverlay": "Phát video",
    "videoCount": "{{count}} video",
    "closePlayer": "Đóng trình phát video"
  },
  "tab": {
    "title": "Video",
    "empty": "Chưa có video nào"
  },
  "seller": {
    "sectionTitle": "Video ({{count}}/{{max}})",
    "createFirst": "Video sẽ được tải lên sau khi bạn lưu sản phẩm",
    "deleteConfirm": "Xóa video này? Hành động này không thể hoàn tác.",
    "cancelUpload": "Hủy tải lên?",
    "durationLimit": "Tối đa {{seconds}} giây"
  },
  "review": {
    "addButton": "Thêm video",
    "processing": "Đang xử lý...",
    "maxSize": "Tối đa 200 MB",
    "durationLimit": "Tối đa 60 giây"
  }
}
```

Add to `"admin"` section:
```json
"admin": {
  ...existing keys...,
  "nav": {
    ...existing keys...,
    "videoModeration": "Kiểm duyệt Video",
    "videoAppeals": "Kháng cáo Video"
  }
}
```

- [ ] **Step 3: Verify no JSON syntax errors**

Run: `cd fe && node -e "JSON.parse(require('fs').readFileSync('src/app/lib/i18n/en.json','utf8')); console.log('en.json OK')" && node -e "JSON.parse(require('fs').readFileSync('src/app/lib/i18n/vi.json','utf8')); console.log('vi.json OK')"`
Expected: Both OK

- [ ] **Step 4: Commit**

```bash
git add fe/src/app/lib/i18n/
git commit -m "feat(i18n): add video integration keys in English and Vietnamese"
```

---

## Task 7: ProductPage Gallery — Discriminated Union + Video First

**Files:**
- Modify: `fe/src/app/pages/ProductPage.tsx:177-230`

- [ ] **Step 1: Define GalleryItem type and build gallery items array**

At the top of the component (after the existing imports), add:

```tsx
import { useProductVideos } from "../../features/videos";
import { VideoPlayer } from "../../features/videos/components/VideoPlayer";
import { IconPlayerPlay } from "@tabler/icons-react";
```

Inside the component, after the existing `images` array derivation (line ~197), add:

```tsx
// Discriminated union for mixed media gallery
type GalleryItem =
  | { type: "image"; url: string }
  | { type: "video"; playbackUrl: string; thumbnailUrl: string; durationSeconds?: number };

const { videos: productVideos, isLoading: videosLoading } = useProductVideos(product.id);

// Videos FIRST, then images
const galleryItems: GalleryItem[] = [
  ...productVideos.map((v) => ({
    type: "video" as const,
    playbackUrl: v.playbackUrl ?? "",
    thumbnailUrl: v.thumbnailUrl ?? "",
    durationSeconds: v.durationSeconds ?? undefined,
  })),
  ...images.map((url) => ({ type: "image" as const, url })),
];

const [galleryIdx, setGalleryIdx] = useState(0);
const [isVideoPlaying, setIsVideoPlaying] = useState(false);
const currentItem = galleryItems[galleryIdx];
```

- [ ] **Step 2: Replace the main gallery area render**

Replace the existing main image `<div>` (the `aspect-square` container) with:

```tsx
<div
  className="relative aspect-square bg-surface-elevated rounded-[var(--radius-xl)] border border-border overflow-hidden group"
  aria-label="Product media gallery"
  role="region"
  tabIndex={galleryItems.length > 1 ? 0 : undefined}
  onKeyDown={
    galleryItems.length > 1
      ? (e) => {
          if (e.key === "Escape" && isVideoPlaying) {
            setIsVideoPlaying(false);
            return;
          }
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            setGalleryIdx((i) => (i - 1 + galleryItems.length) % galleryItems.length);
            setIsVideoPlaying(false);
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            setGalleryIdx((i) => (i + 1) % galleryItems.length);
            setIsVideoPlaying(false);
          }
        }
      : undefined
  }
>
  {isVideoPlaying && currentItem?.type === "video" ? (
    <div className="relative w-full h-full flex items-center justify-center" aria-live="polite">
      <VideoPlayer
        src={currentItem.playbackUrl}
        poster={currentItem.thumbnailUrl}
        className="w-full h-full object-contain"
      />
      <button
        className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
        onClick={() => setIsVideoPlaying(false)}
        aria-label={t("video.gallery.closePlayer")}
      >
        <IconX size={16} />
      </button>
    </div>
  ) : currentItem?.type === "video" ? (
    <button
      className="relative w-full h-full"
      onClick={() => setIsVideoPlaying(true)}
      role="button"
      aria-label={t("video.gallery.playOverlay")}
    >
      <img
        src={currentItem.thumbnailUrl}
        alt="Video thumbnail"
        className="w-full h-full object-contain"
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center">
          <IconPlayerPlay size={32} className="text-white ml-1" />
        </div>
      </div>
    </button>
  ) : currentItem?.type === "image" ? (
    <img
      src={currentItem.url}
      alt={product.name}
      className="w-full h-full object-contain"
    />
  ) : null}
</div>
```

- [ ] **Step 3: Update thumbnail strip to use galleryItems**

Replace the existing thumbnail row with:

```tsx
{galleryItems.length > 1 && (
  <div className="flex gap-2 overflow-x-auto pb-1">
    {galleryItems.map((item, idx) => (
      <button
        key={idx}
        className={`relative shrink-0 w-16 h-16 rounded-[var(--radius-md)] border-2 overflow-hidden transition-colors ${
          idx === galleryIdx ? "border-primary" : "border-border hover:border-muted-foreground"
        }`}
        onClick={() => { setGalleryIdx(idx); setIsVideoPlaying(false); }}
        aria-label={item.type === "video" ? t("video.gallery.playOverlay") : `Image ${idx + 1}`}
      >
        <img
          src={item.type === "video" ? item.thumbnailUrl : item.url}
          alt=""
          className="w-full h-full object-cover"
        />
        {item.type === "video" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <IconPlayerPlay size={14} className="text-white" />
          </div>
        )}
      </button>
    ))}
  </div>
)}
```

- [ ] **Step 4: Remove old `imageIdx` state**

Remove the line `const [imageIdx, setImageIdx] = useState(0);` — replaced by `galleryIdx`.
Update any remaining references to `imageIdx` → `galleryIdx` and `images` → `galleryItems`.

- [ ] **Step 5: Run linter and type-check**

Run: `cd fe && npx tsc --noEmit --project tsconfig.json 2>&1 | head -30`
Expected: No errors in ProductPage.tsx

- [ ] **Step 6: Commit**

```bash
git add fe/src/app/pages/ProductPage.tsx
git commit -m "feat(product): video-first gallery with discriminated union GalleryItem[]"
```

---

## Task 8: ProductPage — Videos Tab (Conditional)

**Files:**
- Modify: `fe/src/app/pages/ProductPage.tsx` (tab section, ~line 528-549)

- [ ] **Step 1: Extend activeTab type**

Change:
```ts
const [activeTab, setActiveTab] = useState<"desc" | "specs" | "reviews" | "qa">("desc");
```
To:
```ts
const [activeTab, setActiveTab] = useState<"desc" | "specs" | "reviews" | "qa" | "videos">("desc");
```

- [ ] **Step 2: Add Videos tab button (conditionally rendered)**

In the tab buttons row, add after the Q&A tab button (only when videos exist):

```tsx
{productVideos.length > 0 && (
  <button
    role="tab"
    aria-selected={activeTab === "videos"}
    aria-label={`${t("video.tab.title")}, ${productVideos.length} ${t("video.gallery.videoCount", { count: productVideos.length })}`}
    className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
      activeTab === "videos"
        ? "border-primary text-primary"
        : "border-transparent text-muted-foreground hover:text-foreground"
    }`}
    onClick={() => setActiveTab("videos")}
  >
    {t("video.tab.title")} ({productVideos.length})
  </button>
)}
```

- [ ] **Step 3: Add Videos tab content panel**

After the existing Q&A panel conditional, add:

```tsx
{activeTab === "videos" && (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    {productVideos.length > 0 ? (
      productVideos.map((video) => (
        <VideoPlayer
          key={video.id}
          src={video.playbackUrl ?? ""}
          poster={video.thumbnailUrl ?? ""}
          className="w-full aspect-video rounded-[var(--radius-lg)]"
        />
      ))
    ) : (
      <p className="col-span-full text-center text-muted-foreground py-8">
        {t("video.tab.empty")}
      </p>
    )}
  </div>
)}
```

- [ ] **Step 4: Type-check**

Run: `cd fe && npx tsc --noEmit --project tsconfig.json 2>&1 | grep -i "ProductPage"`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add fe/src/app/pages/ProductPage.tsx
git commit -m "feat(product): add conditional Videos tab (hidden when count=0)"
```

---

## Task 9: Seller Modal — Video Upload Section

**Files:**
- Modify: `fe/src/app/components/seller-product-modal.tsx`

- [ ] **Step 1: Add imports**

At the top of `seller-product-modal.tsx`, add:

```tsx
import { IconVideo, IconX as IconXClose } from "@tabler/icons-react";
import { useVideoUpload } from "../../features/videos/hooks/useVideoUpload";
import { useVideoStatus } from "../../features/videos/hooks/useVideoStatus";
import { useProductVideos } from "../../features/videos/hooks/useProductVideos";
import { VideoUploadDropzone } from "../../features/videos/components/VideoUploadDropzone";
import { VideoUploadProgress } from "../../features/videos/components/VideoUploadProgress";
import { videoDelete } from "../lib/api/endpoints/videos";
```

- [ ] **Step 2: Add video state and hooks inside the component**

After the existing `phase`/`staged`/`existingImages` state block, add:

```tsx
// ── Video upload state ──
const productId = product?.id ?? null;
const { videos: existingVideos, isLoading: videosLoading } = useProductVideos(productId ?? "");
const videoSlotsFree = 3 - (existingVideos?.length ?? 0);

const {
  state: videoUploadState,
  upload: startVideoUpload,
  cancel: cancelVideoUpload,
  reset: resetVideoUpload,
} = useVideoUpload({
  entityId: productId ?? "",
  context: "PRODUCT",
  onComplete: () => {
    toast.success(t("video.pipeline.doneTitle"));
    queryClient.invalidateQueries({ queryKey: ["videos", "product", productId] });
  },
  onError: (err) => toast.error(err.message),
});

const videoUploading = videoUploadState.phase !== "idle" && videoUploadState.phase !== "error";
```

- [ ] **Step 3: Add video section JSX below images grid**

After the images grid section (after `</div>` that closes the images area), insert:

```tsx
{/* ── Video Upload Section ── */}
<div className="space-y-3">
  <h4 className="text-sm font-medium text-foreground">
    {t("video.seller.sectionTitle", { count: existingVideos.length, max: 3 })}
  </h4>

  {/* Existing videos with status + delete */}
  {existingVideos.map((video) => (
    <div key={video.id} className="flex items-center gap-3 p-2 rounded-[var(--radius-md)] bg-surface-elevated border border-border">
      <img src={video.thumbnailUrl ?? ""} alt="" className="w-16 h-10 object-cover rounded" />
      <span className="flex-1 text-sm truncate">{video.originalFilename ?? "Video"}</span>
      <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
        {video.status}
      </span>
      {video.status === "PUBLISHED" && (
        <button
          className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
          onClick={async () => {
            if (!confirm(t("video.seller.deleteConfirm"))) return;
            await videoDelete(video.id);
            queryClient.invalidateQueries({ queryKey: ["videos", "product", productId] });
          }}
          aria-label="Delete video"
        >
          <IconTrash size={14} />
        </button>
      )}
    </div>
  ))}

  {/* Upload progress (if uploading) */}
  {videoUploading && (
    <div className="flex items-center gap-2">
      <VideoUploadProgress videoId={videoUploadState.videoId} />
      <button
        className="p-1 text-muted-foreground hover:text-red-500"
        onClick={cancelVideoUpload}
        aria-label={t("video.seller.cancelUpload")}
      >
        <IconXClose size={14} />
      </button>
    </div>
  )}

  {/* Dropzone (when slots available and not uploading) */}
  {!videoUploading && videoSlotsFree > 0 && (
    productId ? (
      <VideoUploadDropzone onFile={startVideoUpload} />
    ) : (
      <p className="text-xs text-muted-foreground italic">
        {t("video.seller.createFirst")}
      </p>
    )
  )}
</div>
```

- [ ] **Step 4: Update the isBusy/handleClose logic**

Find the existing `handleClose` and update to include video upload confirmation:

```tsx
const handleClose = () => {
  if (videoUploading) {
    if (!confirm(t("video.seller.cancelUpload"))) return;
    cancelVideoUpload();
  }
  if (isBusy) return;
  onClose();
};
```

- [ ] **Step 5: Type-check**

Run: `cd fe && npx tsc --noEmit --project tsconfig.json 2>&1 | grep -i "seller-product"`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add fe/src/app/components/seller-product-modal.tsx
git commit -m "feat(seller): add video upload section to product modal with progress + cancel"
```

---

## Task 10: Review Video — Display in ReviewCard

**Files:**
- Modify: ReviewCard component (find via: `grep -r "ReviewCard" fe/src/app/`)

- [ ] **Step 1: Add video display to ReviewCard**

Import the hook and player:

```tsx
import { useReviewVideo } from "../../features/videos/hooks/useReviewVideo";
import { VideoPlayer } from "../../features/videos/components/VideoPlayer";
import { IconPlayerPlay } from "@tabler/icons-react";
```

Inside the ReviewCard component, after the review ID is available:

```tsx
const { video: reviewVideo } = useReviewVideo(review.id);
```

In the media row (where review photos are displayed), append after photos:

```tsx
{reviewVideo && reviewVideo.status === "PUBLISHED" && (
  <div className="relative w-20 h-20 rounded-[var(--radius-md)] overflow-hidden shrink-0">
    <VideoPlayer
      src={reviewVideo.playbackUrl ?? ""}
      poster={reviewVideo.thumbnailUrl ?? ""}
      className="w-full h-full object-cover"
    />
  </div>
)}
{reviewVideo && reviewVideo.status !== "PUBLISHED" && reviewVideo.status !== "REJECTED" && (
  <div className="relative w-20 h-20 rounded-[var(--radius-md)] overflow-hidden shrink-0 bg-muted flex items-center justify-center">
    <span className="text-xs text-muted-foreground">{t("video.review.processing")}</span>
  </div>
)}
```

- [ ] **Step 2: Type-check**

Run: `cd fe && npx tsc --noEmit --project tsconfig.json 2>&1 | grep -i "review"`
Expected: No errors related to ReviewCard

- [ ] **Step 3: Commit**

```bash
git add fe/src/app/
git commit -m "feat(reviews): display attached video in ReviewCard media row"
```

---

## Task 11: Final Verification

- [ ] **Step 1: Full type-check**

Run: `cd fe && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Run all video-related tests**

Run: `cd fe && npx vitest run src/features/videos/ src/app/pages/admin/VideoModerationPanel --reporter=verbose`
Expected: All PASS

- [ ] **Step 3: Run full test suite**

Run: `cd fe && npx vitest run --reporter=verbose 2>&1 | tail -20`
Expected: All existing tests still pass

- [ ] **Step 4: Backend test**

Run: `cd services/product-service && ./mvnw test -pl . 2>&1 | tail -20`
Expected: BUILD SUCCESS

- [ ] **Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "chore: final verification pass for video FE integration"
```

---

## Dependency Graph

```
Task 1 (Enum sync + bug fix) ─── no deps, start immediately
Task 2 (Notifications)       ─── no deps, start immediately
Task 3 (Backend endpoint)    ─── no deps, start immediately
Task 4 (FE hooks)            ─── depends on Task 3 (needs backend)
Task 5 (Admin panel)         ─── no deps, start immediately
Task 6 (i18n)                ─── no deps, start immediately
Task 7 (Gallery refactor)    ─── depends on Task 4 (needs useProductVideos)
Task 8 (Videos tab)          ─── depends on Task 7 (uses gallery state)
Task 9 (Seller modal)        ─── depends on Task 4 (needs useProductVideos for count)
Task 10 (Review video)       ─── depends on Task 4 (needs useReviewVideo)
Task 11 (Verification)       ─── depends on ALL above
```

**Parallel tracks:**
- Track A: Task 1 → Task 3 → Task 4 → Tasks 7, 8, 9, 10 (critical path)
- Track B: Tasks 2, 5, 6 (independent, run anytime)
- Track C: Task 11 (final gate)
