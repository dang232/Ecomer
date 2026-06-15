import { CheckCircle, XCircle, Loader2, Upload, Scissors, Shield } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { VideoStatus } from "../../../app/types/api/video";
import { useVideoStatus } from "../hooks/useVideoStatus";

// ─── Pipeline step definitions ────────────────────────────────────────────────

interface PipelineStep {
  key: VideoStatus;
  labelKey: string;
  icon: React.ElementType;
}

const PIPELINE_STEPS: PipelineStep[] = [
  { key: "UPLOADING", labelKey: "video.pipeline.uploading", icon: Upload },
  { key: "TRANSCODING", labelKey: "video.pipeline.transcoding", icon: Scissors },
  { key: "MODERATING", labelKey: "video.pipeline.moderating", icon: Shield },
  { key: "PUBLISHED", labelKey: "video.pipeline.published", icon: CheckCircle },
];

// Ordered list matching backend progression
const STATUS_ORDER: VideoStatus[] = [
  "PENDING",
  "UPLOADING",
  "TRANSCODING",
  "MODERATING",
  "PUBLISHED",
];

function stepState(stepKey: VideoStatus, currentStatus: VideoStatus | undefined): "done" | "active" | "pending" | "error" {
  if (!currentStatus) return "pending";
  if (currentStatus === "REJECTED" || currentStatus === "FAILED") {
    // Show everything up to the failed step as done, rest as error/pending
    const currentIdx = STATUS_ORDER.indexOf(currentStatus as VideoStatus) - 1;
    const stepIdx = STATUS_ORDER.indexOf(stepKey);
    if (stepIdx < currentIdx) return "done";
    return "error";
  }
  const currentIdx = STATUS_ORDER.indexOf(currentStatus);
  const stepIdx = STATUS_ORDER.indexOf(stepKey);
  if (stepKey === "PUBLISHED" && currentStatus === "PUBLISHED") return "done";
  if (stepIdx < currentIdx) return "done";
  if (stepIdx === currentIdx) return "active";
  return "pending";
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface VideoUploadProgressProps {
  videoId: string;
  /** If true the status polling is active. */
  enabled?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VideoUploadProgress({ videoId, enabled = true }: VideoUploadProgressProps) {
  const { t } = useTranslation();
  const { status, isStuck, isLoading } = useVideoStatus(videoId, { enabled });

  const isRejected = status === "REJECTED";
  const isFailed = status === "FAILED";
  const isTerminalError = isRejected || isFailed;
  const isPublished = status === "PUBLISHED";

  return (
    <div className="rounded-[var(--radius-xl)] border border-border bg-card p-4 space-y-4">
      <p className="text-sm font-semibold text-foreground">
        {isPublished
          ? t("video.pipeline.doneTitle")
          : isTerminalError
            ? t("video.pipeline.errorTitle")
            : isStuck
              ? t("video.pipeline.stuckTitle")
              : t("video.pipeline.processingTitle")}
      </p>

      {/* Stuck in pipeline for too long — suggest user contact support */}
      {isStuck && (
        <div className="flex items-start gap-2 p-3 rounded-[var(--radius-md)] bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
          <XCircle size={15} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            {t("video.pipeline.stuckMessage")}
          </p>
        </div>
      )}

      {/* Rejection reason */}
      {isRejected && data?.rejectionReason && (
        <div className="flex items-start gap-2 p-3 rounded-[var(--radius-md)] bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
          <XCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700 dark:text-red-300">
            {t("video.pipeline.rejectionReason", { reason: data.rejectionReason })}
          </p>
        </div>
      )}

      {/* Pipeline steps */}
      <ol className="space-y-2" aria-label={t("video.pipeline.stepsAria")}>
        {PIPELINE_STEPS.map((step) => {
          const state = stepState(step.key, status);
          const Icon = step.icon;

          return (
            <li key={step.key} className="flex items-center gap-3">
              {/* Step icon */}
              <div
                className={[
                  "w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors",
                  state === "done"
                    ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                    : state === "active"
                      ? "bg-primary/10 text-primary"
                      : state === "error"
                        ? "bg-red-100 dark:bg-red-900/30 text-red-500"
                        : "bg-surface-elevated text-muted-foreground",
                ].join(" ")}
                aria-hidden="true"
              >
                {state === "done" ? (
                  <CheckCircle size={14} />
                ) : state === "active" ? (
                  isLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Loader2 size={14} className="animate-spin" />
                  )
                ) : state === "error" ? (
                  <XCircle size={14} />
                ) : (
                  <Icon size={14} />
                )}
              </div>

              {/* Step label */}
              <span
                className={[
                  "text-xs font-medium",
                  state === "done"
                    ? "text-green-700 dark:text-green-400"
                    : state === "active"
                      ? "text-foreground"
                      : state === "error"
                        ? "text-red-600 dark:text-red-400"
                        : "text-muted-foreground",
                ].join(" ")}
              >
                {t(step.labelKey)}
              </span>

              {/* Active spinner label */}
              {state === "active" && (
                <span className="text-xs text-muted-foreground ml-auto">
                  {t("video.pipeline.inProgress")}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
