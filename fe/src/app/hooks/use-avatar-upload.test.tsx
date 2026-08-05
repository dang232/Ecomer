import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type UnknownCall = (...args: unknown[]) => unknown;
type AvatarErrorCall = (error: Error) => void;

const avatarUploadMock = vi.fn<UnknownCall>();
const avatarActivateMock = vi.fn<UnknownCall>();

vi.mock("@/shared/api/endpoints/users", () => ({
  avatarUpload: (...args: unknown[]) => avatarUploadMock(...args),
  avatarActivate: (...args: unknown[]) => avatarActivateMock(...args),
}));

import { makeWrapper } from "@/shared/test/render-with-query-client";

import { __testables__, useAvatarUpload } from "./use-avatar-upload";

const ABC_DIGEST = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

function makeFile(
  opts: { name?: string; type?: string; size?: number; bytes?: Uint8Array<ArrayBuffer> } = {},
) {
  const bytes = opts.bytes ?? new Uint8Array(opts.size ?? 1024);
  // Real File object so the size + type + arrayBuffer code path lights up.
  const file = new File([bytes], opts.name ?? "selfie.jpg", {
    type: opts.type ?? "image/jpeg",
  });
  // jsdom's File doesn't always implement arrayBuffer; polyfill for the hook.
  if (!file.arrayBuffer) {
    Object.defineProperty(file, "arrayBuffer", {
      value: () => Promise.resolve(bytes.slice().buffer),
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
      const onError = vi.fn<AvatarErrorCall>();
      const { result } = renderHook(() => useAvatarUpload({ onError }), { wrapper: Wrapper });
      const huge = makeFile({ size: 3 * 1024 * 1024 });

      await act(async () => {
        result.current.mutate(huge);
      });
      await waitFor(() => expect(onError).toHaveBeenCalled());

      expect(onError.mock.calls[0]?.[0]?.message).toBe("avatar:too-large");
      expect(avatarUploadMock).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
      expect(avatarActivateMock).not.toHaveBeenCalled();
    });

    it("rejects unsupported content types before any API call", async () => {
      const { Wrapper } = makeWrapper();
      const onError = vi.fn<AvatarErrorCall>();
      const { result } = renderHook(() => useAvatarUpload({ onError }), { wrapper: Wrapper });
      const wrong = makeFile({ type: "image/gif", name: "anim.gif" });

      await act(async () => {
        result.current.mutate(wrong);
      });
      await waitFor(() => expect(onError).toHaveBeenCalled());

      expect(onError.mock.calls[0]?.[0]?.message).toBe("avatar:wrong-type");
      expect(avatarUploadMock).not.toHaveBeenCalled();
    });

    it("rejects empty files (size 0)", () => {
      // The throw lives in `preflight` so we can drive it directly without
      // running the full mutation pipeline.
      expect(() => __testables__.preflight(makeFile({ size: 0 }))).toThrow("avatar:empty");
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

    it("uploads avatars when Web Crypto is unavailable", async () => {
      const { Wrapper } = makeWrapper();
      vi.stubGlobal("crypto", undefined);
      avatarUploadMock.mockResolvedValue({
        objectKey: "avatars/u1/abc.jpg",
        uploadUrl: "http://minio/sig",
        expiresInSeconds: 300,
      });
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, status: 200 });
      avatarActivateMock.mockResolvedValue({ id: "u1", avatar: "http://minio/avatar.jpg" });

      const { result } = renderHook(() => useAvatarUpload(), { wrapper: Wrapper });
      const file = makeFile({ bytes: new Uint8Array([97, 98, 99]) });

      await act(async () => {
        result.current.mutate(file);
      });
      await waitFor(() => expect(avatarActivateMock).toHaveBeenCalled());

      expect(avatarUploadMock).toHaveBeenCalledWith(
        expect.objectContaining({ sha256Hex: ABC_DIGEST }),
      );
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

      const onError = vi.fn<AvatarErrorCall>();
      const { result } = renderHook(() => useAvatarUpload({ onError }), { wrapper: Wrapper });

      await act(async () => {
        result.current.mutate(makeFile({ size: 1024 }));
      });
      await waitFor(() => expect(onError).toHaveBeenCalled());

      expect(onError.mock.calls[0]?.[0]?.message).toBe("avatar:put-failed:502");
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

      const onError = vi.fn<AvatarErrorCall>();
      const { result } = renderHook(() => useAvatarUpload({ onError }), { wrapper: Wrapper });

      await act(async () => {
        result.current.mutate(makeFile({ size: 1024 }));
      });
      await waitFor(() => expect(onError).toHaveBeenCalled());

      expect(onError.mock.calls[0]?.[0]?.message).toBe("activate-rejected");
      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });
});
