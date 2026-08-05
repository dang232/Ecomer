import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/shared/api";
import { avatarActivate, avatarUpload } from "@/shared/api/endpoints/users";
import { Sha256Error, sha256FileHex } from "@/shared/lib/sha256";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/** Pre-flight client-side validation. The BE re-validates everything; this
 *  is just for snappier UX (no round-trip to the API for a wrong-type pick).
 *  Throwing an Error here trips React Query's onError so the toast surfaces
 *  the same way as a server-side rejection. */
function preflight(file: File): void {
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error("avatar:too-large");
  }
  if (file.size <= 0) {
    throw new Error("avatar:empty");
  }
  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    throw new Error("avatar:wrong-type");
  }
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
    throw new Error("avatar:wrong-extension");
  }
}

interface AvatarUploadOptions {
  /** Surface to the caller for toast/UI; the hook itself doesn't render. */
  onSuccess?: (avatarUrl: string | undefined) => void;
  onError?: (error: Error) => void;
}

/**
 * Two-phase avatar upload mutation. Sequence:
 *   1. POST /users/me/avatar/upload → presigned PUT URL + objectKey.
 *   2. PUT the file body straight to MinIO (browser → object store, no
 *      proxy through user-service so worker threads stay free).
 *   3. POST /users/me/avatar/activate to verify and write the URL.
 *   4. Invalidate ["users", "me"] so vnshop-context picks up the new
 *      avatar URL on the next read.
 *
 * If step 2 fails (network, MinIO down) we do NOT call /activate — the
 * BE only persists the URL after seeing the object via headObject, so
 * stranding a half-uploaded state is impossible from this side.
 */
export function useAvatarUpload(options: AvatarUploadOptions = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      preflight(file);
      const sha256Hex = await sha256FileHex(file);
      const init = await avatarUpload({
        filename: file.name,
        contentType: file.type,
        contentLength: file.size,
        sha256Hex,
      });

      const putResponse = await fetch(init.uploadUrl, {
        method: "PUT",
        body: file,
        signal: AbortSignal.timeout(30_000),
        headers: {
          "Content-Type": file.type,
          "x-amz-meta-sha256": sha256Hex,
        },
      });
      if (!putResponse.ok) {
        throw new Error(`avatar:put-failed:${putResponse.status}`);
      }

      const profile = await avatarActivate({
        objectKey: init.objectKey,
        contentLength: file.size,
        sha256Hex,
      });
      return profile;
    },
    onSuccess: (profile) => {
      void qc.invalidateQueries({ queryKey: ["users", "me"] });
      options.onSuccess?.(profile.avatar);
    },
    onError: (err) => {
      options.onError?.(err instanceof Error ? err : new Error(String(err)));
    },
  });
}

export const __testables__ = {
  preflight,
  MAX_AVATAR_BYTES,
  ALLOWED_TYPES,
  ALLOWED_EXTENSIONS,
};

/** Translate the structured Error throw codes into i18n keys for the toast.
 *  Lets ApiError messages from the BE pass through unchanged. */
export function avatarUploadErrorMessage(error: unknown, t: (key: string) => string): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Sha256Error) {
    return error.message;
  }
  if (error instanceof Error) {
    if (error.message === "avatar:too-large") return t("profile.avatar.errors.tooLarge");
    if (error.message === "avatar:empty") return t("profile.avatar.errors.empty");
    if (error.message === "avatar:wrong-type") return t("profile.avatar.errors.wrongType");
    if (error.message === "avatar:wrong-extension")
      return t("profile.avatar.errors.wrongExtension");
    if (error.message.startsWith("avatar:put-failed:"))
      return t("profile.avatar.errors.uploadFailed");
  }
  return t("profile.avatar.errors.generic");
}
