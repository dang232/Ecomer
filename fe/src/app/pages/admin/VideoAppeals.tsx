import {
  IconCircleCheck,
  IconCircleX,
  IconMessageCircle,
  IconVideo,
  IconX,
} from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { FormDialog } from "../../components/form-dialog";
import {
  useApproveAppeal,
  useRejectAppeal,
  useVideoAppeals,
} from "../../hooks/use-admin-video-moderation";
import { formatDate } from "../../lib/format";
import type { AdminVideoAppealItem } from "../../types/api";

// ─── Duration formatter ───────────────────────────────────────────────────────

function formatDuration(seconds: number | undefined): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── NSFW badge ───────────────────────────────────────────────────────────────

function NsfwBadge({ score }: { score: number | undefined }) {
  if (score === undefined) return null;
  const pct = Math.round(score * 100);
  const color =
    pct >= 70
      ? { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400" }
      : pct >= 40
        ? { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400" }
        : {
            bg: "bg-emerald-100 dark:bg-emerald-900/30",
            text: "text-emerald-700 dark:text-emerald-400",
          };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${color.bg} ${color.text}`}>
      NSFW {pct}%
    </span>
  );
}

// ─── Video preview modal ──────────────────────────────────────────────────────

function AppealVideoModal({ item, onClose }: { item: AdminVideoAppealItem; onClose: () => void }) {
  const { t } = useTranslation();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("admin.videoAppeals.previewTitle")}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="bg-card rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-base font-bold text-foreground">
            {t("admin.videoAppeals.previewTitle")}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center"
            aria-label={t("admin.videoAppeals.closePreview")}
          >
            <IconX size={16} />
          </button>
        </div>

        <div className="aspect-video bg-black w-full">
          {item.presignedUrl ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption -- admin appeal review; captions not applicable for moderation workflow
            <video
              src={item.presignedUrl ?? ""}
              controls
              className="w-full h-full"
              poster={item.posterUrl ?? undefined}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-sm text-white/60">{t("admin.videoAppeals.noPreview")}</p>
            </div>
          )}
        </div>

        <div className="px-5 py-4 space-y-3">
          {item.rejectionReason ? (
            <div className="bg-red-50 dark:bg-red-950/30 rounded-xl p-3">
              <p className="text-[11px] font-bold text-red-600 dark:text-red-400 mb-1">
                {t("admin.videoAppeals.originalRejection")}
              </p>
              <p className="text-sm text-foreground">{item.rejectionReason}</p>
            </div>
          ) : null}
          {item.appealReason ? (
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3">
              <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 mb-1">
                {t("admin.videoAppeals.userAppealReason")}
              </p>
              <p className="text-sm text-foreground">{item.appealReason}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Appeal row ────────────────────────────────────────────────────────────────

function AppealRow({
  item,
  onPreview,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: {
  item: AdminVideoAppealItem;
  onPreview: () => void;
  onApprove: () => void;
  onReject: () => void;
  isApproving: boolean;
  isRejecting: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="bg-card rounded-2xl p-4 shadow-sm space-y-3">
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Thumbnail */}
        <button
          onClick={onPreview}
          className="relative shrink-0 w-full sm:w-32 h-20 rounded-xl overflow-hidden bg-muted flex items-center justify-center group"
          aria-label={t("admin.videoAppeals.previewAria", { id: item.videoId })}
        >
          {item.posterUrl ? (
            <img
              src={item.posterUrl}
              alt=""
              className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
            />
          ) : (
            <IconVideo size={28} className="text-muted-foreground" />
          )}
          {item.durationSeconds ? (
            <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
              {formatDuration(item.durationSeconds)}
            </span>
          ) : null}
        </button>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap mb-1.5">
            <p className="text-xs font-mono text-muted-foreground truncate">{item.videoId}</p>
            <NsfwBadge score={item.nsfwScore ?? undefined} />
          </div>
          <p className="text-sm font-semibold text-foreground truncate">
            {item.uploaderName ?? t("admin.videoAppeals.unknownUploader")}
          </p>
          {item.createdAt ? (
            <p className="text-xs text-muted-foreground mt-0.5">{formatDate(item.createdAt)}</p>
          ) : null}
        </div>
      </div>

      {/* Reasons */}
      <div className="space-y-2">
        {item.rejectionReason ? (
          <div className="bg-red-50 dark:bg-red-950/20 rounded-xl px-3 py-2">
            <p className="text-[11px] font-bold text-red-600 dark:text-red-400 mb-0.5">
              {t("admin.videoAppeals.originalRejection")}
            </p>
            <p className="text-xs text-foreground line-clamp-2">{item.rejectionReason}</p>
          </div>
        ) : null}
        {item.appealReason ? (
          <div className="bg-blue-50 dark:bg-blue-950/20 rounded-xl px-3 py-2 flex gap-2">
            <IconMessageCircle
              size={13}
              className="text-blue-500 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div>
              <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 mb-0.5">
                {t("admin.videoAppeals.userAppealReason")}
              </p>
              <p className="text-xs text-foreground line-clamp-2">{item.appealReason}</p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 justify-end flex-wrap">
        <button
          onClick={onPreview}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-border text-foreground hover:bg-muted transition-colors"
        >
          {t("admin.videoAppeals.preview")}
        </button>
        <button
          onClick={onApprove}
          disabled={isApproving || isRejecting}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50 transition-colors"
          style={{ background: "var(--success)" }}
        >
          <IconCircleCheck size={13} />
          {t("admin.videoAppeals.approve")}
        </button>
        <button
          onClick={onReject}
          disabled={isRejecting || isApproving}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 text-red-500 disabled:opacity-50 transition-colors"
        >
          <IconCircleX size={13} />
          {t("admin.videoAppeals.rejectFinal")}
        </button>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export function VideoAppeals() {
  const { t } = useTranslation();
  const [previewItem, setPreviewItem] = useState<AdminVideoAppealItem | null>(null);
  const [rejectFor, setRejectFor] = useState<string | null>(null);

  const appealsQuery = useVideoAppeals();
  const approveAppeal = useApproveAppeal();
  const rejectAppeal = useRejectAppeal();

  const items = appealsQuery.data?.content ?? [];

  return (
    <div className="space-y-5">
      <FormDialog
        open={!!rejectFor}
        title={t("admin.videoAppeals.rejectDialog.title")}
        description={t("admin.videoAppeals.rejectDialog.description")}
        submitLabel={t("admin.videoAppeals.rejectDialog.submit")}
        submitColor="var(--error)"
        fields={[
          {
            key: "reason",
            label: t("admin.videoAppeals.rejectDialog.reasonLabel"),
            placeholder: t("admin.videoAppeals.rejectDialog.reasonPlaceholder"),
            type: "textarea",
            required: true,
          },
        ]}
        onClose={() => setRejectFor(null)}
        onSubmit={({ reason }) => {
          if (rejectFor) rejectAppeal.mutate({ videoId: rejectFor, reason });
        }}
        isSubmitting={rejectAppeal.isPending}
      />

      {previewItem ? (
        <AppealVideoModal item={previewItem} onClose={() => setPreviewItem(null)} />
      ) : null}

      <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
        {t("admin.videoAppeals.title")}
        {!appealsQuery.isLoading && (appealsQuery.data?.totalElements ?? 0) > 0 ? (
          <span className="text-xs font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5">
            {appealsQuery.data?.totalElements}
          </span>
        ) : null}
      </h2>

      {appealsQuery.isLoading ? (
        // P2-10: 3-row skeleton (matches the count the user is waiting for)
        <div
          className="space-y-2"
          role="status"
          aria-live="polite"
          aria-label={t("admin.videoAppeals.loading")}
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-card rounded-2xl p-4 shadow-sm animate-pulse flex items-center gap-3"
            >
              <div className="w-20 h-12 rounded-md bg-surface-elevated" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-surface-elevated rounded w-1/3" />
                <div className="h-3 bg-surface-elevated rounded w-1/2" />
              </div>
              <div className="flex gap-2">
                <div className="h-8 w-16 bg-surface-elevated rounded" />
                <div className="h-8 w-16 bg-surface-elevated rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {appealsQuery.error ? (
        <div className="bg-card rounded-2xl p-5 shadow-sm">
          <p className="text-sm text-red-600 dark:text-red-400">
            {appealsQuery.error instanceof Error
              ? appealsQuery.error.message
              : t("admin.videoAppeals.loadErr")}
          </p>
        </div>
      ) : null}

      {!appealsQuery.isLoading && items.length === 0 && !appealsQuery.error ? (
        <div className="bg-card rounded-2xl p-8 text-center shadow-sm">
          <IconMessageCircle
            size={32}
            className="text-muted-foreground mx-auto mb-2"
            aria-hidden="true"
          />
          <p className="text-sm text-muted-foreground">{t("admin.videoAppeals.empty")}</p>
        </div>
      ) : null}

      <div className="space-y-3">
        {items.map((item) => (
          <AppealRow
            key={item.videoId}
            item={item}
            onPreview={() => setPreviewItem(item)}
            onApprove={() => approveAppeal.mutate(item.videoId)}
            onReject={() => setRejectFor(item.videoId)}
            isApproving={approveAppeal.isPending ? approveAppeal.variables === item.videoId : false}
            isRejecting={
              rejectAppeal.isPending ? rejectAppeal.variables?.videoId === item.videoId : false
            }
          />
        ))}
      </div>
    </div>
  );
}
