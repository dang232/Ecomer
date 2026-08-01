import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import * as tus from "tus-js-client";
import { z } from "zod";

import { videoUploadInit } from "@/shared/api/endpoints/videos";
import type { VideoContext } from "@/shared/contracts/api/video";

import { readJsonText } from "../../../shared/api/read-json";

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_PRODUCT_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB
const MAX_REVIEW_VIDEO_BYTES = 200 * 1024 * 1024; // 200 MB

const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime", // .mov
  "video/webm",
  "video/x-matroska", // .mkv
] as const;

const ALLOWED_VIDEO_EXTENSIONS = ["mp4", "mov", "webm", "mkv"] as const;

const LS_RESUME_KEY = "vnshop:video-upload-resume";

// ─── Types ───────────────────────────────────────────────────────────────────

export type VideoUploadPhase =
  "idle" | "validating" | "initiating" | "uploading" | "complete" | "error";

export interface VideoUploadState {
  phase: VideoUploadPhase;
  /** Upload progress 0–100. */
  progress: number;
  /** Server-assigned video ID once initiation succeeds. */
  videoId: string | null;
  /** Error message if phase === "error". */
  error: string | null;
  /** Estimated duration in seconds from the video element metadata. */
  estimatedDuration: number | null;
  /** Filename of the file being uploaded. */
  filename: string | null;
}

export interface VideoUploadOptions {
  entityId: string;
  context: VideoContext;
  onComplete?: (videoId: string) => void;
  onError?: (error: Error) => void;
}

// ─── Resume URL cache ────────────────────────────────────────────────────────

const resumeEntrySchema = z.object({
  videoId: z.string().min(1),
  uploadUrl: z.string().url(),
  filename: z.string().min(1),
  sizeBytes: z.number().positive(),
});
type ResumeEntry = z.infer<typeof resumeEntrySchema>;

function getResumeEntry(idempotencyKey: string): ResumeEntry | null {
  try {
    const raw = localStorage.getItem(`${LS_RESUME_KEY}:${idempotencyKey}`);
    return raw ? readJsonText(raw, resumeEntrySchema) : null;
  } catch {
    try {
      localStorage.removeItem(`${LS_RESUME_KEY}:${idempotencyKey}`);
    } catch {
      /* browser storage is unavailable */
    }
    return null;
  }
}

function setResumeEntry(idempotencyKey: string, entry: ResumeEntry): void {
  try {
    localStorage.setItem(`${LS_RESUME_KEY}:${idempotencyKey}`, JSON.stringify(entry));
  } catch {
    // localStorage full — silently skip; upload still works, just no resume
  }
}

function clearResumeEntry(idempotencyKey: string): void {
  try {
    localStorage.removeItem(`${LS_RESUME_KEY}:${idempotencyKey}`);
  } catch {
    // ignore
  }
}

// ─── Pre-flight validation ───────────────────────────────────────────────────

/** Client-side preflight. BE re-validates everything; this avoids needless round-trips. */
export function preflightVideo(file: File, context: VideoContext): void {
  const maxBytes = context === "PRODUCT" ? MAX_PRODUCT_VIDEO_BYTES : MAX_REVIEW_VIDEO_BYTES;
  const maxMb = maxBytes / (1024 * 1024);

  if (file.size <= 0) throw new Error("video:empty");
  if (file.size > maxBytes) throw new Error(`video:too-large:${maxMb}`);

  if (!ALLOWED_VIDEO_TYPES.includes(file.type as (typeof ALLOWED_VIDEO_TYPES)[number])) {
    throw new Error("video:wrong-type");
  }

  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (!ALLOWED_VIDEO_EXTENSIONS.includes(ext as (typeof ALLOWED_VIDEO_EXTENSIONS)[number])) {
    throw new Error("video:wrong-extension");
  }
}

// ─── Duration estimation ─────────────────────────────────────────────────────

/** Load a File into a temporary <video> element to read its duration. */
export function estimateDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.src = "";
    };
    video.onloadedmetadata = () => {
      const dur = isFinite(video.duration) && video.duration > 0 ? video.duration : null;
      cleanup();
      resolve(dur);
    };
    video.onerror = () => {
      cleanup();
      resolve(null);
    };
    video.src = url;
  });
}

// ─── Hook ────────────────────────────────────────────────────────────────────

const INITIAL_STATE: VideoUploadState = {
  phase: "idle",
  progress: 0,
  videoId: null,
  error: null,
  estimatedDuration: null,
  filename: null,
};

export function useVideoUpload(options: VideoUploadOptions) {
  const [state, setState] = useState<VideoUploadState>(INITIAL_STATE);
  // Keep a ref to the active tus Upload so we can abort it on cancel.
  const uploadRef = useRef<tus.Upload | null>(null);
  // Stable idempotency key per file — regenerated when a new upload begins.
  const idempotencyKeyRef = useRef<string>("");
  // BA audit 2026-06-16 P2-4: keep a ref to the last file so retry() can
  // re-upload without the user re-selecting from disk.
  const lastFileRef = useRef<File | null>(null);

  const reset = useCallback(() => {
    uploadRef.current?.abort(true).catch(() => undefined);
    uploadRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  const cancel = useCallback(() => {
    if (uploadRef.current) {
      void uploadRef.current.abort(true).catch(() => undefined);
      uploadRef.current = null;
    }
    if (idempotencyKeyRef.current) {
      clearResumeEntry(idempotencyKeyRef.current);
    }
    setState(INITIAL_STATE);
  }, []);

  const upload = useCallback(
    async (file: File) => {
      lastFileRef.current = file;
      // 1. Validate
      setState({ ...INITIAL_STATE, phase: "validating", filename: file.name });
      try {
        preflightVideo(file, options.context);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "video:unknown";
        setState((s) => ({ ...s, phase: "error", error: msg }));
        options.onError?.(err instanceof Error ? err : new Error(msg));
        return;
      }

      // 2. Estimate duration (non-blocking — best effort)
      setState((s) => ({ ...s, phase: "validating" }));
      const durationSeconds = await estimateDuration(file);

      // 3. Idempotency key — stable for this file across refreshes
      //    Key is based on name + size + last-modified so the same file reuses the same slot.
      const idempotencyKey = `${file.name}:${file.size}:${file.lastModified}`;
      idempotencyKeyRef.current = idempotencyKey;

      // 4. Initiate upload (or recover resume URL from localStorage)
      setState((s) => ({ ...s, phase: "initiating", estimatedDuration: durationSeconds }));

      let tusEndpoint: string;
      let videoId: string;

      const cached = getResumeEntry(idempotencyKey);
      if (cached?.sizeBytes === file.size && cached?.filename === file.name) {
        tusEndpoint = cached.uploadUrl;
        videoId = cached.videoId;
      } else {
        try {
          const init = await videoUploadInit({
            entityId: options.entityId,
            context: options.context,
            filename: file.name,
            contentType: file.type,
            sizeBytes: file.size,
            durationSeconds: durationSeconds ?? undefined,
            idempotencyKey: crypto.randomUUID(),
          });
          tusEndpoint = init.tusEndpoint;
          videoId = init.videoId;
          setResumeEntry(idempotencyKey, {
            videoId,
            uploadUrl: tusEndpoint,
            filename: file.name,
            sizeBytes: file.size,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "video:init-failed";
          setState((s) => ({ ...s, phase: "error", error: msg }));
          options.onError?.(err instanceof Error ? err : new Error(msg));
          return;
        }
      }

      setState((s) => ({ ...s, phase: "uploading", videoId }));

      // 5. Drive tus upload
      const tusUpload = new tus.Upload(file, {
        endpoint: tusEndpoint,
        retryDelays: [0, 1000, 3000, 5000],
        chunkSize: 5 * 1024 * 1024, // 5 MB chunks
        metadata: {
          filename: file.name,
          filetype: file.type,
          videoId,
          entityId: options.entityId,
          context: options.context,
          idempotencyKey,
        },
        onProgress(bytesUploaded, bytesTotal) {
          const pct = bytesTotal > 0 ? Math.round((bytesUploaded / bytesTotal) * 100) : 0;
          setState((s) => ({ ...s, progress: pct }));
        },
        onSuccess() {
          clearResumeEntry(idempotencyKey);
          setState((s) => ({ ...s, phase: "complete", progress: 100 }));
          toast.success("Video uploaded, processing…");
          options.onComplete?.(videoId);
        },
        onError(err) {
          const msg = err instanceof Error ? err.message : "video:upload-failed";
          setState((s) => ({ ...s, phase: "error", error: msg }));
          options.onError?.(err instanceof Error ? err : new Error(msg));
        },
      });

      // Check for a previous partial upload to resume
      const previousUploads = await tusUpload.findPreviousUploads();
      if (previousUploads.length > 0) {
        tusUpload.resumeFromPreviousUpload(previousUploads[0]);
      }

      uploadRef.current = tusUpload;
      tusUpload.start();
    },
    [options],
  );

  // P2-4: retry the last file without requiring the user to re-select it
  const retry = useCallback(() => {
    const last = lastFileRef.current;
    if (last) void upload(last);
  }, [upload]);

  return { state, upload, cancel, reset, retry };
}

// ─── Error message helper ────────────────────────────────────────────────────

export function videoUploadErrorMessage(
  error: unknown,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (!(error instanceof Error)) return t("video.upload.errors.generic");
  const msg = error.message;
  if (msg === "video:empty") return t("video.upload.errors.empty");
  if (msg === "video:wrong-type") return t("video.upload.errors.wrongType");
  if (msg === "video:wrong-extension") return t("video.upload.errors.wrongExtension");
  if (msg === "video:init-failed") return t("video.upload.errors.initFailed");
  if (msg === "video:upload-failed") return t("video.upload.errors.uploadFailed");
  if (msg.startsWith("video:too-large:")) {
    const mb = msg.split(":")[2];
    return t("video.upload.errors.tooLarge", { maxMb: mb });
  }
  return t("video.upload.errors.generic");
}

export const __testables__ = {
  preflightVideo,
  estimateDuration,
  MAX_PRODUCT_VIDEO_BYTES,
  MAX_REVIEW_VIDEO_BYTES,
  ALLOWED_VIDEO_TYPES,
  ALLOWED_VIDEO_EXTENSIONS,
};
