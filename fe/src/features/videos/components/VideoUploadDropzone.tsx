import { useRef, useState } from "react";
import { Upload, X, FileVideo, AlertCircle, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { VideoUploadState } from "../hooks/useVideoUpload";
import { videoUploadErrorMessage } from "../hooks/useVideoUpload";

// ─── Types ───────────────────────────────────────────────────────────────────

interface VideoUploadDropzoneProps {
  uploadState: VideoUploadState;
  onFileSelected: (file: File) => void;
  onCancel: () => void;
  /** Max size label shown in the hint, e.g. "500MB" */
  maxSizeLabel?: string;
  disabled?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function VideoUploadDropzone({
  uploadState,
  onFileSelected,
  onCancel,
  maxSizeLabel = "500MB",
  disabled = false,
}: VideoUploadDropzoneProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const { phase, progress, filename, error } = uploadState;
  const isActive = phase !== "idle" && phase !== "error";
  const isError = phase === "error";
  const isComplete = phase === "complete";
  const isBusy = isActive && phase !== "complete";
  const isPreUpload = phase === "initiating" || phase === "validating";

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || disabled || isBusy) return;
    onFileSelected(files[0]);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!disabled && !isBusy) setDragging(true);
  }

  function handleDragLeave() {
    setDragging(false);
  }

  // ── Idle / error state — show dropzone ──────────────────────────────────
  if (!isActive || isError) {
    return (
      <div className="space-y-2">
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label={t("video.upload.dropzone.ariaLabel")}
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !disabled) {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={[
            "relative flex flex-col items-center justify-center gap-3 rounded-[var(--radius-xl)] border-2 border-dashed p-8 transition-colors cursor-pointer",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2",
            dragging
              ? "border-primary bg-surface-elevated"
              : isError
                ? "border-red-400 bg-red-50 dark:bg-red-950/20"
                : "border-border hover:border-primary hover:bg-surface-elevated",
            disabled ? "opacity-50 cursor-not-allowed" : "",
          ].join(" ")}
        >
          {isError ? (
            <AlertCircle size={32} className="text-red-500" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload size={22} className="text-primary" />
            </div>
          )}

          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">
              {isError
                ? t("video.upload.dropzone.errorTitle")
                : t("video.upload.dropzone.title")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {isError
                ? videoUploadErrorMessage(
                    new Error(uploadState.error ?? "video:unknown"),
                    t,
                  )
                : t("video.upload.dropzone.hint", {
                    maxSize: maxSizeLabel,
                    formats: "MP4, MOV, WebM, MKV",
                  })}
            </p>
          </div>

          {isError && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              className="mt-1 px-4 py-2 min-h-[44px] rounded-[var(--radius-md)] border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              {t("video.upload.dropzone.tryAgain")}
            </button>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.webm,.mkv"
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    );
  }

  // ── Active upload state — show progress card ─────────────────────────────
  return (
    <div className="rounded-[var(--radius-xl)] border border-border bg-card p-4 space-y-3">
      {/* File info row */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-[var(--radius-lg)] bg-primary/10 flex items-center justify-center shrink-0">
          <FileVideo size={18} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {filename ?? t("video.upload.dropzone.unknownFile")}
          </p>
          <p
            className="text-xs text-muted-foreground"
            aria-live="polite"
          >
            {isComplete
              ? t("video.upload.dropzone.complete")
              : phase === "initiating"
                ? t("video.upload.dropzone.initiating")
                : phase === "validating"
                  ? t("video.upload.dropzone.validating")
                  : t("video.upload.dropzone.uploading", { progress })}
          </p>
        </div>
        {/* Cancel button — only while actively uploading. P1-10: 44px touch target. */}
        {isBusy && (
          <button
            type="button"
            onClick={onCancel}
            aria-label={t("video.upload.dropzone.cancelAria")}
            className="min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Progress — P1-11: at 0% the bar would be invisible, so during
          initiating/validating show a spinner instead. Otherwise the bar
          still has min-width: 4px so it's never invisible. */}
      {!isComplete && (
        isPreUpload ? (
          <div
            className="h-1.5 w-full rounded-full bg-surface-elevated flex items-center justify-center"
            role="status"
            aria-live="polite"
            aria-label={t("video.upload.dropzone.initiating")}
          >
            <Loader2 size={14} className="text-primary animate-spin" aria-hidden="true" />
          </div>
        ) : (
          <div
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t("video.upload.dropzone.progressAria")}
            className="h-1.5 w-full rounded-full bg-surface-elevated overflow-hidden"
          >
            <div
              className="h-full rounded-full bg-primary transition-all duration-300 min-w-[4px]"
              style={{ width: `${progress}%` }}
            />
          </div>
        )
      )}

      {/* Thumbnail preview once processing starts */}
      {isComplete && uploadState.videoId && (
        <p className="text-xs text-muted-foreground">
          {t("video.upload.dropzone.processingNote")}
        </p>
      )}
    </div>
  );
}
