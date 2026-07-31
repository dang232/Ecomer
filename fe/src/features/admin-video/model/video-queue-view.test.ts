import { describe, expect, it } from "vitest";

import type {
  AdminVideoAppealItem,
  AdminVideoModerationQueueItem,
} from "@/shared/contracts/api";

import {
  appealUiPageToBackend,
  moderationUiPageToBackend,
  toVideoAppealView,
  toVideoModerationView,
} from "./video-queue-view";

describe("video-queue-view", () => {
  describe("toVideoModerationView", () => {
    it("maps raw queue item to view", () => {
      const raw: AdminVideoModerationQueueItem = {
        videoId: "video-1",
        ownerId: "owner-1",
        productId: null,
        reviewId: null,
        stagingKey: null,
        publicKey: null,
        status: "PENDING_REVIEW",
        rejectionReason: null,
        moderatedBy: null,
        moderatedAt: null,
        publishedAt: null,
        createdAt: "2026-01-10T00:00:00Z",
        nsfwScore: 0.42,
        posterUrl: "https://example.com/poster.jpg",
        durationSeconds: 60,
        uploaderName: "Alice",
      };
      const view = toVideoModerationView(raw);
      expect(view.videoId).toBe("video-1");
      expect(view.nsfwScore).toBe(0.42);
      expect(view.uploaderName).toBe("Alice");
    });

    it("normalizes nullable fields", () => {
      const raw: AdminVideoModerationQueueItem = {
        videoId: "video-2",
        ownerId: null,
        productId: null,
        reviewId: null,
        stagingKey: null,
        publicKey: null,
        status: "PENDING_REVIEW",
        rejectionReason: null,
        moderatedBy: null,
        moderatedAt: null,
        publishedAt: null,
        createdAt: null,
      };
      const view = toVideoModerationView(raw);
      expect(view.ownerId).toBeNull();
      expect(view.posterUrl).toBeNull();
      expect(view.uploaderName).toBeNull();
      expect(view.durationSeconds).toBeNull();
      expect(view.nsfwScore).toBeNull();
    });
  });

  describe("toVideoAppealView", () => {
    it("maps raw appeal item to view", () => {
      const raw: AdminVideoAppealItem = {
        videoId: "video-3",
        status: "APPEAL_PENDING",
        rejectionReason: "old reason",
        appealReason: "please reconsider",
        uploaderName: "Bob",
        createdAt: "2026-02-01T00:00:00Z",
        posterUrl: null,
        presignedUrl: null,
      };
      const view = toVideoAppealView(raw);
      expect(view.rejectionReason).toBe("old reason");
      expect(view.appealReason).toBe("please reconsider");
      expect(view.uploaderName).toBe("Bob");
    });
  });

  describe("page mapping", () => {
    it("maps UI page 1 → backend 0 (moderation)", () => {
      expect(moderationUiPageToBackend(1)).toBe(0);
    });

    it("maps UI page 3 → backend 2 (moderation)", () => {
      expect(moderationUiPageToBackend(3)).toBe(2);
    });

    it("clamps UI page 0 → backend 0 (moderation)", () => {
      expect(moderationUiPageToBackend(0)).toBe(0);
    });

    it("maps UI page 1 → backend 0 (appeal)", () => {
      expect(appealUiPageToBackend(1)).toBe(0);
    });
  });
});