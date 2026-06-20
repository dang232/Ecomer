import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const avatarUploadMock = vi.fn();
const avatarActivateMock = vi.fn();

vi.mock("../lib/api/endpoints/users", () => ({
  avatarUpload: (...args: unknown[]) => avatarUploadMock(...args),
  avatarActivate: (...args: unknown[]) => avatarActivateMock(...args),
}));

import { __testables__, useAvatarUpload } from "./use-avatar-upload";
import { makeWrapper } from "../test-utils/render-with-query-client";


function makeFile(opts: { name?: string; type?: string; size?: number } = {}) {
  const size = opts.size ?? 1024;
  // Real File object so the size + type + arrayBuffer code path lights up.
  const file = new File([new Uint8Array(size)], opts.name ?? "selfie.jpg", {
    type: opts.type ?? "image/jpeg",
  });
  // jsdom's File doesn't always implement arrayBuffer; polyfill for the hook.
  if (!file.arrayBuffer) {
    Object.defineProperty(file, "arrayBuffer", {
      value: () => Promise.resolve(new ArrayBuffer(size)),
    });
  }
  return file;
}

beforeEach(() => {
  avatarUploadMock.mockReset();
  avatarActivateMock.mockReset();
  vi.stubGlobal("fetch", vi.fn());
  vi.stubGlobal("crypto", {
    subtle: {
      digest: vi.fn(async () => new Uint8Array(32).fill(0xab).buffer),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("useAvatarUpload", () => {
  describe("preflight (client-side checks)", () => {
    it("rejects files over 2 MB before any API call", async () => {
      const { Wrapper } = makeWrapper();
      const onError = vi.fn();
      const { result } = renderHook(() => useAvatarUpload({ onError }), { wrapper: Wrapper });
      const huge = makeFile({ size: 3 * 1024 * 1024 });

      await act(async () => {
        result.current.mutate(huge);
      });
      await waitFor(() => expect(onError).toHaveBeenCalled());

      expect(onError.mock.calls[0][0].message).toBe("avatar:too-large");
      expect(avatarUploadMock).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
      expect(avatarActivateMock).not.toHaveBeenCalled();
    });

    it("rejects unsupported content types before any API call", async () => {
      const { Wrapper } = makeWrapper();
      const onError = vi.fn();
      const { result } = renderHook(() => useAvatarUpload({ onError }), { wrapper: Wrapper });
      const wrong = makeFile({ type: "image/gif", name: "anim.gif" });

      await act(async () => {
        result.current.mutate(wrong);
      });
      await waitFor(() => expect(onError).toHaveBeenCalled());

      expect(onError.mock.calls[0][0].message).toBe("avatar:wrong-type");
      expect(avatarUploadMock).not.toHaveBeenCalled();
    });

    it("rejects empty files (size 0)", () => {
      // The throw lives in `preflight` so we can drive it directly without
      // running the full mutation pipeline.
      expect(() => __testables__.preflight(makeFile({ size: 0 })))
        .toThrow("avatar:empty");
    });
  });

  describe("happy path", () => {
    it("orchestrates POST /upload → PUT to MinIO → POST /activate and invalidates", async () => {
      const { Wrapper, client } = makeWrapper();
      const invalidateSpy = vi.spyOn(client, "invalidateQueries");
      avatarUploadMock.mockResolvedValue({
        objectKey: "avatars/u1/now-rand.jpg",
        uploadUrl: "http://localhost:9000/vnshop-avatars/avatars/u1/now-rand.jpg?sig",
        expiresInSeconds: 300,
      });
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, status: 200 });
      avatarActivateMock.mockResolvedValue({
        id: "u1",
        avatar: "http://localhost:9000/vnshop-avatars/avatars/u1/now-rand.jpg",
      });

      const onSuccess = vi.fn();
      const { result } = renderHook(() => useAvatarUpload({ onSuccess }), { wrapper: Wrapper });
      const file = makeFile({ size: 4096 });

      await act(async () => {
        result.current.mutate(file);
      });
      await waitFor(() => expect(onSuccess).toHaveBeenCalled());

      // 1. /upload sees the size + sha + content-type the FE measured.
      expect(avatarUploadMock).toHaveBeenCalledWith({
        filename: "selfie.jpg",
        contentType: "image/jpeg",
        contentLength: 4096,
        sha256Hex: "ab".repeat(32),
      });
      // 2. PUT to MinIO with the file body and content-type.
      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:9000/vnshop-avatars/avatars/u1/now-rand.jpg?sig",
        expect.objectContaining({ method: "PUT" }),
      );
      // 3. /activate echoes the objectKey + size + sha back to the BE.
      expect(avatarActivateMock).toHaveBeenCalledWith({
        objectKey: "avatars/u1/now-rand.jpg",
        contentLength: 4096,
        sha256Hex: "ab".repeat(32),
      });
      // 4. Cache invalidation is what makes the navbar/profile re-fetch.
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["users", "me"] });
      expect(onSuccess.mock.calls[0][0]).toContain("/vnshop-avatars/");
    });
  });

  describe("error paths", () => {
    it("does NOT call /activate when the PUT to MinIO fails", async () => {
      const { Wrapper, client } = makeWrapper();
      const invalidateSpy = vi.spyOn(client, "invalidateQueries");
      avatarUploadMock.mockResolvedValue({
        objectKey: "avatars/u1/k.jpg",
        uploadUrl: "http://minio/sig",
        expiresInSeconds: 300,
      });
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 502 });

      const onError = vi.fn();
      const { result } = renderHook(() => useAvatarUpload({ onError }), { wrapper: Wrapper });

      await act(async () => {
        result.current.mutate(makeFile({ size: 1024 }));
      });
      await waitFor(() => expect(onError).toHaveBeenCalled());

      expect(onError.mock.calls[0][0].message).toBe("avatar:put-failed:502");
      expect(avatarActivateMock).not.toHaveBeenCalled();
      expect(invalidateSpy).not.toHaveBeenCalled();
    });

    it("surfaces /activate failures (BE size/sha/headObject mismatch) without invalidating", async () => {
      const { Wrapper, client } = makeWrapper();
      const invalidateSpy = vi.spyOn(client, "invalidateQueries");
      avatarUploadMock.mockResolvedValue({
        objectKey: "avatars/u1/k.jpg",
        uploadUrl: "http://minio/sig",
        expiresInSeconds: 300,
      });
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, status: 200 });
      avatarActivateMock.mockRejectedValue(new Error("activate-rejected"));

      const onError = vi.fn();
      const { result } = renderHook(() => useAvatarUpload({ onError }), { wrapper: Wrapper });

      await act(async () => {
        result.current.mutate(makeFile({ size: 1024 }));
      });
      await waitFor(() => expect(onError).toHaveBeenCalled());

      expect(onError.mock.calls[0][0].message).toBe("activate-rejected");
      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });
});
