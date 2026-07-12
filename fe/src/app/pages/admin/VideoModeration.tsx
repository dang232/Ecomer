import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconCircleCheck,
  IconCircleX,
  IconFilter,
  IconVideo,
  IconX,
} from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { FormDialog } from "../../components/form-dialog";
import {
  useApproveVideo,
  useRejectVideo,
  useVideoModerationQueue,
  useVideoPreview,
  type VideoModerationQueueParams,
} from "../../hooks/use-admin-video-moderation";
import { formatDate } from "../../lib/format";
import type { AdminVideoModerationQueueItem } from "../../types/api";

// ─── NSFW score badge ─────────────────────────────────────────────────────────

function NsfwBadge({ score }: { score: number | undefined }) {
  if (score === undefined) return null;
  const pct = Math.round(score * 100);
  const color =
    pct >= 70
      ? { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400" }
      : pct >= 40
        ? { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400" }
        : { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400" };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${color.bg} ${color.text}`}
      aria-label={`NSFW score ${pct}%`}
    >
      NSFW {pct}%
    </span>
  );
}

// ─── Duration formatter ───────────────────────────────────────────────────────

function formatDuration(seconds: number | undefined): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── Video preview modal ──────────────────────────────────────────────────────

function VideoPreviewModal({
  videoId,
  item,
  onClose,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: {
  videoId: string;
  item: AdminVideoModerationQueueItem;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  isApproving: boolean;
  isRejecting: boolean;
}) {
  const { t } = useTranslation();
  const { data: previewUrl, isLoading } = useVideoPreview(videoId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("admin.videoModeration.previewTitle")}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-base font-bold text-foreground">
            {t("admin.videoModeration.previewTitle")}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center"
            aria-label={t("admin.videoModeration.closePreview")}
          >
            <IconX size={16} />
          </button>
        </div>

        <div className="aspect-video bg-black w-full">
          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-sm text-white/60">{t("admin.videoModeration.loadingPreview")}</p>
            </div>
          ) : previewUrl?.url ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption -- admin moderation preview; captions not applicable for NSFW review workflow
            <video
              src={previewUrl.url}
              controls
              className="w-full h-full"
              poster={item.nsfwScore !== undefined ? undefined : undefined}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-sm text-white/60">{t("admin.videoModeration.noPreview")}</p>
            </div>
          )}
        </div>

        <div className="px-5 py-3 bg-muted/40 text-xs text-muted-foreground flex items-center gap-4 flex-wrap">
          {item.createdAt ? <span>{formatDate(item.createdAt)}</span> : null}
        </div>

        <div className="px-5 py-4 border-t border-border flex gap-3 justify-end">
          <button
            onClick={onReject}
            disabled={isRejecting || isApproving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-red-200 text-red-500 disabled:opacity-50 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          >
            <IconCircleX size={15} />
            {t("admin.videoModeration.reject")}
          </button>
          <button
            onClick={onApprove}
            disabled={isApproving || isRejecting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-colors"
            style={{ background: "var(--success)" }}
          >
            <IconCircleCheck size={15} />
            {t("admin.videoModeration.approve")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Video row ─────────────────────────────────────────────────────────────────

function VideoRow({
  item,
  onPreview,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: {
  item: AdminVideoModerationQueueItem;
  onPreview: () => void;
  onApprove: () => void;
  onReject: () => void;
  isApproving: boolean;
  isRejecting: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="bg-card rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-4">
      {/* Thumbnail */}
      <button
        onClick={onPreview}
        className="relative shrink-0 w-full sm:w-32 h-20 rounded-xl overflow-hidden bg-muted flex items-center justify-center group"
        aria-label={t("admin.videoModeration.previewAria", { id: item.videoId })}
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
          {item.uploaderName ?? t("admin.videoModeration.unknownUploader")}
        </p>
        {item.createdAt ? (
          <p className="text-xs text-muted-foreground mt-0.5">{formatDate(item.createdAt)}</p>
        ) : null}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
        <button
          onClick={onPreview}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-border text-foreground hover:bg-muted transition-colors"
        >
          {t("admin.videoModeration.preview")}
        </button>
        <button
          onClick={onApprove}
          disabled={isApproving || isRejecting}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50 transition-colors"
          style={{ background: "var(--success)" }}
        >
          <IconCircleCheck size={13} />
          {t("admin.videoModeration.approve")}
        </button>
        <button
          onClick={onReject}
          disabled={isRejecting || isApproving}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 text-red-500 disabled:opacity-50 transition-colors"
        >
          <IconCircleX size={13} />
          {t("admin.videoModeration.reject")}
        </button>
      </div>
    </div>
  );
}

// ─── Filter bar ────────────────────────────────────────────────────────────────

interface FilterState {
  fromDate: string;
  toDate: string;
  minScore: string;
  maxScore: string;
  ownerType: string;
}

function FilterBar({
  filters,
  onChange,
}: {
  filters: FilterState;
  onChange: (f: FilterState) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
        aria-expanded={open}
      >
        <IconFilter size={13} />
        {t("admin.videoModeration.filter")}
      </button>

      {open ? (
        <div className="mt-3 bg-card rounded-2xl border border-border p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              <IconCalendar size={11} className="inline mr-1" />
              {t("admin.videoModeration.fromDate")}
            </label>
            <input
              type="date"
              value={filters.fromDate}
              onChange={(e) => onChange({ ...filters, fromDate: e.target.value })}
              className="w-full px-2 py-1.5 border border-border rounded-lg text-xs outline-none focus:border-[var(--primary)] bg-background"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              {t("admin.videoModeration.toDate")}
            </label>
            <input
              type="date"
              value={filters.toDate}
              onChange={(e) => onChange({ ...filters, toDate: e.target.value })}
              className="w-full px-2 py-1.5 border border-border rounded-lg text-xs outline-none focus:border-[var(--primary)] bg-background"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              {t("admin.videoModeration.minScore")} (0–100)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={filters.minScore}
              onChange={(e) => onChange({ ...filters, minScore: e.target.value })}
              className="w-full px-2 py-1.5 border border-border rounded-lg text-xs outline-none focus:border-[var(--primary)] bg-background"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              {t("admin.videoModeration.maxScore")} (0–100)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={filters.maxScore}
              onChange={(e) => onChange({ ...filters, maxScore: e.target.value })}
              className="w-full px-2 py-1.5 border border-border rounded-lg text-xs outline-none focus:border-[var(--primary)] bg-background"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              {t("admin.videoModeration.ownerType")}
            </label>
            <select
              value={filters.ownerType}
              onChange={(e) => onChange({ ...filters, ownerType: e.target.value })}
              className="w-full px-2 py-1.5 border border-border rounded-lg text-xs outline-none focus:border-[var(--primary)] bg-background"
            >
              <option value="">{t("admin.videoModeration.ownerTypeAll")}</option>
              <option value="SELLER">SELLER</option>
              <option value="BUYER">BUYER</option>
            </select>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export function VideoModeration() {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<FilterState>({
    fromDate: "",
    toDate: "",
    minScore: "",
    maxScore: "",
    ownerType: "",
  });
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<string | null>(null);

  const queryParams: VideoModerationQueueParams = {
    page,
    size: 20,
    ...(filters.fromDate ? { fromDate: filters.fromDate } : {}),
    ...(filters.toDate ? { toDate: filters.toDate } : {}),
    ...(filters.minScore !== "" ? { minScore: Number(filters.minScore) / 100 } : {}),
    ...(filters.maxScore !== "" ? { maxScore: Number(filters.maxScore) / 100 } : {}),
    ...(filters.ownerType ? { ownerType: filters.ownerType } : {}),
  };

  const queueQuery = useVideoModerationQueue(queryParams);
  const approve = useApproveVideo();
  const reject = useRejectVideo();

  const items = queueQuery.data?.content ?? [];
  const previewItem = previewId ? items.find((i) => i.videoId === previewId) ?? null : null;
  const totalPages = queueQuery.data?.totalPages ?? 1;
  const totalElements = queueQuery.data?.totalElements ?? 0;

  const handleApprove = (videoId: string) => {
    if (previewId === videoId) setPreviewId(null);
    approve.mutate(videoId);
  };

  const handleRejectConfirm = (videoId: string, reason: string) => {
    reject.mutate(
      { videoId, reason },
      {
        onSuccess: () => {
          setRejectFor(null);
          if (previewId === videoId) setPreviewId(null);
        },
      },
    );
  };

  return (
    <div className="space-y-5">
      <FormDialog
        open={!!rejectFor}
        title={t("admin.videoModeration.rejectDialog.title")}
        description={t("admin.videoModeration.rejectDialog.description")}
        submitLabel={t("admin.videoModeration.rejectDialog.submit")}
        submitColor="var(--error)"
        fields={[
          {
            key: "reason",
            label: t("admin.videoModeration.rejectDialog.reasonLabel"),
            placeholder: t("admin.videoModeration.rejectDialog.reasonPlaceholder"),
            type: "textarea",
            required: true,
          },
        ]}
        onClose={() => setRejectFor(null)}
        onSubmit={({ reason }) => {
          if (rejectFor) handleRejectConfirm(rejectFor, reason);
        }}
        isSubmitting={reject.isPending}
      />

      {previewId && previewItem ? (
        <VideoPreviewModal
          videoId={previewId}
          item={previewItem}
          onClose={() => setPreviewId(null)}
          onApprove={() => handleApprove(previewId)}
          onReject={() => {
            setRejectFor(previewId);
            setPreviewId(null);
          }}
          isApproving={approve.isPending}
          isRejecting={reject.isPending}
        />
      ) : null}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {t("admin.videoModeration.title")}
          </h2>
          {!queueQuery.isLoading && totalElements > 0 ? (
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("admin.videoModeration.totalCount", { count: totalElements })}
            </p>
          ) : null}
        </div>
        <FilterBar
          filters={filters}
          onChange={(f) => {
            setFilters(f);
            setPage(0);
          }}
        />
      </div>

      {queueQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("admin.videoModeration.loading")}</p>
      ) : null}

      {queueQuery.error ? (
        <div className="bg-card rounded-2xl p-5 shadow-sm">
          <p className="text-sm text-red-600 dark:text-red-400">
            {queueQuery.error instanceof Error
              ? queueQuery.error.message
              : t("admin.videoModeration.loadErr")}
          </p>
        </div>
      ) : null}

      {!queueQuery.isLoading && items.length === 0 && !queueQuery.error ? (
        <div className="bg-card rounded-2xl p-8 text-center shadow-sm">
          <IconVideo size={32} className="text-muted-foreground mx-auto mb-2" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{t("admin.videoModeration.empty")}</p>
        </div>
      ) : null}

      <div className="space-y-3">
        {items.map((item) => (
          <VideoRow
            key={item.videoId}
            item={item}
            onPreview={() => setPreviewId(item.videoId)}
            onApprove={() => handleApprove(item.videoId)}
            onReject={() => setRejectFor(item.videoId)}
            isApproving={approve.isPending ? approve.variables === item.videoId : false}
            isRejecting={reject.isPending ? reject.variables?.videoId === item.videoId : false}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="w-8 h-8 rounded-xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors"
            aria-label={t("admin.videoModeration.prevPage")}
          >
            <IconChevronLeft size={16} />
          </button>
          <span className="text-xs text-muted-foreground">
            {t("admin.videoModeration.pageOf", { current: page + 1, total: totalPages })}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="w-8 h-8 rounded-xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors"
            aria-label={t("admin.videoModeration.nextPage")}
          >
            <IconChevronRight size={16} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
