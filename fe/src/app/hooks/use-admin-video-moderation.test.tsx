import { renderHook, waitFor, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── API mocks (must be declared before importing the module under test) ───────

const {
  adminVideoModerationQueueMock,
  adminVideoPreviewMock,
  adminApproveVideoMock,
  adminRejectVideoMock,
  adminVideoAppealsQueueMock,
  adminApproveAppealMock,
  adminRejectAppealMock,
} = vi.hoisted(() => ({
  adminVideoModerationQueueMock: vi.fn(),
  adminVideoPreviewMock: vi.fn(),
  adminApproveVideoMock: vi.fn(),
  adminRejectVideoMock: vi.fn(),
  adminVideoAppealsQueueMock: vi.fn(),
  adminApproveAppealMock: vi.fn(),
  adminRejectAppealMock: vi.fn(),
}));

vi.mock("../lib/api/endpoints/admin", () => ({
  adminVideoModerationQueue: adminVideoModerationQueueMock,
  adminVideoPreview: adminVideoPreviewMock,
  adminApproveVideo: adminApproveVideoMock,
  adminRejectVideo: adminRejectVideoMock,
  adminVideoAppealsQueue: adminVideoAppealsQueueMock,
  adminApproveAppeal: adminApproveAppealMock,
  adminRejectAppeal: adminRejectAppealMock,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { makeWrapper } from "../test-utils/render-with-query-client";

import {
  useVideoModerationQueue,
  useVideoPreview,
  useApproveVideo,
  useRejectVideo,
  useVideoAppeals,
  useApproveAppeal,
  useRejectAppeal,
} from "./use-admin-video-moderation";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makePage = (count = 2) => ({
  content: Array.from({ length: count }, (_, i) => ({
    videoId: `vid-${i}`,
    status: "PENDING_REVIEW",
    nsfwScore: 0.1 * i,
    uploaderName: `user-${i}`,
    createdAt: "2025-01-01T00:00:00Z",
  })),
  totalElements: count,
  totalPages: 1,
  page: 0,
  size: count,
});

const makeAppeal = (videoId = "vid-0") => ({
  videoId,
  status: "APPEAL_PENDING",
  rejectionReason: "nudity",
  appealReason: "Not nudity",
  uploaderName: "user-0",
  createdAt: "2025-01-01T00:00:00Z",
});

beforeEach(() => {
  adminVideoModerationQueueMock.mockReset();
  adminVideoPreviewMock.mockReset();
  adminApproveVideoMock.mockReset();
  adminRejectVideoMock.mockReset();
  adminVideoAppealsQueueMock.mockReset();
  adminApproveAppealMock.mockReset();
  adminRejectAppealMock.mockReset();
});

afterEach(() => vi.clearAllMocks());

// ─── useVideoModerationQueue ──────────────────────────────────────────────────

describe("useVideoModerationQueue", () => {
  it("returns page data on success", async () => {
    const page = makePage(3);
    adminVideoModerationQueueMock.mockResolvedValue(page);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useVideoModerationQueue(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.content).toHaveLength(3);
    expect(result.current.data?.totalElements).toBe(3);
  });

  it("passes filter params to the API", async () => {
    adminVideoModerationQueueMock.mockResolvedValue(makePage(0));
    const { Wrapper } = makeWrapper();
    const params = { page: 1, size: 10, ownerType: "SELLER" };
    renderHook(() => useVideoModerationQueue(params), { wrapper: Wrapper });

    await waitFor(() => expect(adminVideoModerationQueueMock).toHaveBeenCalledWith(params));
  });

  it("surfaces error state on failure", async () => {
    adminVideoModerationQueueMock.mockRejectedValue(new Error("network error"));
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useVideoModerationQueue(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ─── useVideoPreview ──────────────────────────────────────────────────────────

describe("useVideoPreview", () => {
  it("fetches preview when videoId is provided", async () => {
    adminVideoPreviewMock.mockResolvedValue({ url: "https://cdn/vid-1.mp4" });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useVideoPreview("vid-1"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.url).toBe("https://cdn/vid-1.mp4");
  });

  it("does not fetch when videoId is null", () => {
    const { Wrapper } = makeWrapper();
    renderHook(() => useVideoPreview(null), { wrapper: Wrapper });
    expect(adminVideoPreviewMock).not.toHaveBeenCalled();
  });
});

// ─── useApproveVideo ──────────────────────────────────────────────────────────

describe("useApproveVideo", () => {
  it("calls adminApproveVideo with the correct id", async () => {
    adminApproveVideoMock.mockResolvedValue({ videoId: "vid-1", status: "APPROVED" });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useApproveVideo(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate("vid-1");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(adminApproveVideoMock).toHaveBeenCalledWith("vid-1");
  });
});

// ─── useRejectVideo ───────────────────────────────────────────────────────────

describe("useRejectVideo", () => {
  it("calls adminRejectVideo with id and reason", async () => {
    adminRejectVideoMock.mockResolvedValue({ videoId: "vid-1", status: "REJECTED" });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useRejectVideo(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ videoId: "vid-1", reason: "inappropriate content" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(adminRejectVideoMock).toHaveBeenCalledWith("vid-1", { reason: "inappropriate content" });
  });
});

// ─── useVideoAppeals ──────────────────────────────────────────────────────────

describe("useVideoAppeals", () => {
  it("returns appeal list on success", async () => {
    const appeals = [makeAppeal("vid-0"), makeAppeal("vid-1")];
    adminVideoAppealsQueueMock.mockResolvedValue({
      content: appeals,
      totalElements: appeals.length,
      totalPages: 1,
      page: 0,
      size: appeals.length,
    });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useVideoAppeals(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.content).toHaveLength(2);
    expect(result.current.data?.content[0]?.videoId).toBe("vid-0");
  });
});

// ─── useApproveAppeal ─────────────────────────────────────────────────────────

describe("useApproveAppeal", () => {
  it("calls adminApproveAppeal with correct videoId", async () => {
    adminApproveAppealMock.mockResolvedValue({ videoId: "vid-0", status: "APPROVED" });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useApproveAppeal(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate("vid-0");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(adminApproveAppealMock).toHaveBeenCalledWith("vid-0");
  });
});

// ─── useRejectAppeal ──────────────────────────────────────────────────────────

describe("useRejectAppeal", () => {
  it("calls adminRejectAppeal with videoId and reason", async () => {
    adminRejectAppealMock.mockResolvedValue({ videoId: "vid-0", status: "REJECTED" });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useRejectAppeal(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ videoId: "vid-0", reason: "policy violation" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(adminRejectAppealMock).toHaveBeenCalledWith("vid-0", { reason: "policy violation" });
  });
});
