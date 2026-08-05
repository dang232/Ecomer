import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import * as tus from "tus-js-client";
import { z } from "zod";

import { csrfAuthHeader, getAccessToken } from "@/shared/auth/native-auth";
import { apiUrl } from "@/shared/config/runtime-endpoints";
import type { VideoContext } from "@/shared/contracts/api/video";
import { sha256FileHex } from "@/shared/lib/sha256";

import { readJsonText } from "../../../shared/api/read-json";

const MAX_PRODUCT_VIDEO_BYTES = 500 * 1024 * 1024;
const MAX_REVIEW_VIDEO_BYTES = 200 * 1024 * 1024;
const DURATION_METADATA_TIMEOUT_MS = 5_000;

const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
] as const;

const ALLOWED_VIDEO_EXTENSIONS = ["mp4", "mov", "webm", "mkv"] as const;

const LS_RESUME_KEY = "vnshop:video-upload-resume";

export type VideoUploadPhase =
  "idle" | "validating" | "initiating" | "uploading" | "complete" | "error";

export interface VideoUploadState {
  phase: VideoUploadPhase;
  progress: number;
  entityId: string | null;
  videoId: string | null;
  error: string | null;
  estimatedDuration: number | null;
  filename: string | null;
}

export interface VideoUploadOptions {
  entityId: string;
  context: VideoContext;
  onComplete?: (videoId: string) => void;
  onError?: (error: Error) => void;
}

const resumeEntrySchema = z.object({
  videoId: z.string().min(1),
  uploadUrl: z.string().url(),
  filename: z.string().min(1),
  sizeBytes: z.number().positive(),
  contentHash: z.string().length(64),
  idempotencyKey: z.string().min(1),
});
type ResumeEntry = z.infer<typeof resumeEntrySchema>;

type UploadLocation = Pick<ResumeEntry, "videoId" | "uploadUrl">;

function parseUploadLocation(location: string, requestUrl: string): UploadLocation {
  try {
    const request = new URL(requestUrl);
    const upload = new URL(location, request);
    const prefix = `${request.pathname.replace(/\/$/, "")}/`;

    if (
      upload.origin !== request.origin ||
      upload.search ||
      upload.hash ||
      !upload.pathname.startsWith(prefix)
    ) {
      throw new Error("invalid upload location");
    }

    const encodedVideoId = upload.pathname.slice(prefix.length);
    if (!encodedVideoId || encodedVideoId.includes("/")) {
      throw new Error("invalid upload location");
    }

    const videoId = decodeURIComponent(encodedVideoId);
    if (!videoId) {
      throw new Error("invalid upload location");
    }

    return { videoId, uploadUrl: upload.toString() };
  } catch {
    throw new Error("video:invalid-upload-location");
  }
}

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
    // best-effort cache only
  }
}

function clearResumeEntry(idempotencyKey: string): void {
  try {
    localStorage.removeItem(`${LS_RESUME_KEY}:${idempotencyKey}`);
  } catch {
    // ignore
  }
}

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

export function estimateDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    let settled = false;
    const timeout = window.setTimeout(() => finish(null), DURATION_METADATA_TIMEOUT_MS);

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.src = "";
    };

    const finish = (duration: number | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      cleanup();
      resolve(duration);
    };

    video.onloadedmetadata = () => {
      const duration =
        Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null;
      finish(duration);
    };
    video.onerror = () => finish(null);
    video.src = url;
  });
}

const INITIAL_STATE: VideoUploadState = {
  phase: "idle",
  progress: 0,
  entityId: null,
  videoId: null,
  error: null,
  estimatedDuration: null,
  filename: null,
};

export function useVideoUpload(options: VideoUploadOptions) {
  const [state, setState] = useState<VideoUploadState>(INITIAL_STATE);
  const uploadRef = useRef<tus.Upload | null>(null);
  const idempotencyKeyRef = useRef("");
  const resumeKeyRef = useRef("");
  const lastFileRef = useRef<File | null>(null);
  const runVersionRef = useRef(0);

  const clearActiveUpload = useCallback((clearResume = true) => {
    runVersionRef.current += 1;
    uploadRef.current?.abort(true).catch(() => undefined);
    uploadRef.current = null;
    if (clearResume && resumeKeyRef.current) {
      clearResumeEntry(resumeKeyRef.current);
    }
    idempotencyKeyRef.current = "";
    resumeKeyRef.current = "";
    lastFileRef.current = null;
  }, []);

  const reset = useCallback(() => {
    clearActiveUpload();
    setState(INITIAL_STATE);
  }, [clearActiveUpload]);

  const cancel = useCallback(() => {
    clearActiveUpload();
    setState(INITIAL_STATE);
  }, [clearActiveUpload]);

  useEffect(() => {
    clearActiveUpload();
    setState(INITIAL_STATE);
  }, [clearActiveUpload, options.context, options.entityId]);

  const upload = useCallback(
    async (file: File) => {
      const runVersion = runVersionRef.current + 1;
      runVersionRef.current = runVersion;
      const isCurrentRun = () => runVersionRef.current === runVersion;

      lastFileRef.current = file;
      setState({
        ...INITIAL_STATE,
        phase: "validating",
        entityId: options.entityId,
        filename: file.name,
      });

      try {
        preflightVideo(file, options.context);
      } catch (err) {
        if (!isCurrentRun()) return;
        const message = err instanceof Error ? err.message : "video:unknown";
        setState((current) => ({ ...current, phase: "error", error: message }));
        options.onError?.(err instanceof Error ? err : new Error(message));
        return;
      }

      setState((current) => ({ ...current, phase: "validating", entityId: options.entityId }));
      const durationSeconds = await estimateDuration(file);
      if (!isCurrentRun()) return;

      const contentHash = await sha256FileHex(file);
      if (!isCurrentRun()) return;

      const resumeKey = `${options.context}:${options.entityId}:${file.name}:${file.size}:${file.lastModified}:${contentHash}`;
      resumeKeyRef.current = resumeKey;
      const cached = getResumeEntry(resumeKey);
      const idempotencyKey =
        cached?.contentHash === contentHash ? cached.idempotencyKey : crypto.randomUUID();
      idempotencyKeyRef.current = idempotencyKey;

      setState((current) => ({
        ...current,
        phase: "initiating",
        entityId: options.entityId,
        estimatedDuration: durationSeconds,
      }));

      const tusEndpoint = apiUrl("/videos/upload");
      const accessToken = getAccessToken();
      const uploadHeaders = {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(csrfAuthHeader() ?? {}),
      };
      let videoId: string | null = null;
      let uploadUrl: string | null = null;

      if (cached?.sizeBytes === file.size && cached.filename === file.name) {
        try {
          const parsed = parseUploadLocation(cached.uploadUrl, tusEndpoint);
          if (parsed.videoId === cached.videoId) {
            videoId = parsed.videoId;
            uploadUrl = parsed.uploadUrl;
          } else {
            clearResumeEntry(resumeKey);
          }
        } catch {
          clearResumeEntry(resumeKey);
        }
      }
      if (!isCurrentRun()) return;

      setState((current) => ({
        ...current,
        phase: "uploading",
        entityId: options.entityId,
        videoId,
      }));

      const tusUpload = new tus.Upload(file, {
        endpoint: tusEndpoint,
        uploadUrl,
        fingerprint: () => Promise.resolve(idempotencyKey),
        removeFingerprintOnSuccess: true,
        headers: uploadHeaders,
        retryDelays: [0, 1000, 3000, 5000],
        chunkSize: 5 * 1024 * 1024,
        metadata: {
          filename: file.name,
          filetype: file.type,
          ownerType: options.context,
          ownerId: options.entityId,
          idempotencyKey,
        },
        onAfterResponse(request, response) {
          if (!isCurrentRun()) return;
          if (request.getMethod() !== "POST" || response.getStatus() !== 201) return;

          const location = response.getHeader("Location");
          if (!location) throw new Error("video:invalid-upload-location");

          const parsed = parseUploadLocation(location, request.getURL());
          videoId = parsed.videoId;
          uploadUrl = parsed.uploadUrl;
          setResumeEntry(resumeKey, {
            videoId,
            uploadUrl,
            filename: file.name,
            sizeBytes: file.size,
            contentHash,
            idempotencyKey,
          });
          setState((current) => ({ ...current, entityId: options.entityId, videoId }));
        },
        onProgress(bytesUploaded, bytesTotal) {
          if (!isCurrentRun()) return;
          const progress = bytesTotal > 0 ? Math.round((bytesUploaded / bytesTotal) * 100) : 0;
          setState((current) => ({ ...current, entityId: options.entityId, progress }));
        },
        onSuccess() {
          if (!isCurrentRun()) return;
          if (!videoId) {
            const error = new Error("video:missing-upload-location");
            setState((current) => ({ ...current, phase: "error", error: error.message }));
            options.onError?.(error);
            return;
          }

          clearResumeEntry(resumeKey);
          uploadRef.current = null;
          setState((current) => ({
            ...current,
            phase: "complete",
            entityId: options.entityId,
            progress: 100,
          }));
          toast.success("Video uploaded, processing...");
          options.onComplete?.(videoId);
        },
        onError(err) {
          if (!isCurrentRun()) return;
          const message = err instanceof Error ? err.message : "video:upload-failed";
          setState((current) => ({ ...current, phase: "error", error: message }));
          options.onError?.(err instanceof Error ? err : new Error(message));
        },
      });

      const previousUploads = await tusUpload.findPreviousUploads();
      if (!isCurrentRun()) return;
      if (previousUploads.length > 0) {
        tusUpload.resumeFromPreviousUpload(previousUploads[0]);
      }

      uploadRef.current = tusUpload;
      tusUpload.start();
    },
    [options],
  );

  const retry = useCallback(() => {
    const lastFile = lastFileRef.current;
    if (lastFile) void upload(lastFile);
  }, [upload]);

  return { state, upload, cancel, reset, retry };
}

export function videoUploadErrorMessage(
  error: unknown,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (!(error instanceof Error)) return t("video.upload.errors.generic");
  const message = error.message;
  if (message === "video:empty") return t("video.upload.errors.empty");
  if (message === "video:wrong-type") return t("video.upload.errors.wrongType");
  if (message === "video:wrong-extension") return t("video.upload.errors.wrongExtension");
  if (message === "video:init-failed") return t("video.upload.errors.initFailed");
  if (message === "video:upload-failed") return t("video.upload.errors.uploadFailed");
  if (message.startsWith("video:too-large:")) {
    const maxMb = message.split(":")[2];
    return t("video.upload.errors.tooLarge", { maxMb });
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
