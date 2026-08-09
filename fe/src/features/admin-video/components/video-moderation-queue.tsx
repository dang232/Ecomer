import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { useAdminCursorPagination } from "@/features/admin";
import { isCursorResetError } from "@/shared/api";
import { adminApproveVideo, adminRejectVideo } from "@/shared/api/endpoints/admin";
import { CursorPagination } from "@/shared/ui/cursor-pagination";
import { DataTable, type DataTableColumn } from "@/shared/ui/data-table";
import { EmptyState } from "@/shared/ui/empty-state";
import { PageContainer } from "@/shared/ui/page-container";
import { PageHeader } from "@/shared/ui/page-header";

import { adminVideoModerationCursorQueryOptions } from "../api/query-options";
import { toVideoModerationView, type VideoModerationView } from "../model/video-queue-view";

import { VideoDecisionDialog } from "./video-decision-dialog";
import { VideoPreviewDrawer } from "./video-preview-drawer";

/**
 * Video moderation queue. URL owns `page` (1-based). Approval/rejection
 * invalidate the moderation list only — not other admin queues. The preview
 * drawer is mounted separately from any record drawer because its 16:9
 * aspect-ratio surface doesn't fit the standard drawer shell.
 */
export function VideoModerationQueue() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const selected = searchParams.get("selected");
  const cursorPagination = useAdminCursorPagination({ scopeKey: "moderation" });

  const { data, isLoading, isError, isFetching, error } = useQuery({
    ...adminVideoModerationCursorQueryOptions({
      cursor: cursorPagination.cursor,
      limit: cursorPagination.pageSize,
    }),
    placeholderData: (previous) => previous,
  });

  const [rejectTarget, setRejectTarget] = useState<{
    videoId: string;
    variant: "reject" | "reject-appeal";
  } | null>(null);

  const approveMutation = useMutation({
    mutationFn: (videoId: string) => adminApproveVideo(videoId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "video"] });
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("selected");
          return next;
        },
        { replace: true },
      );
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ videoId, reason }: { videoId: string; reason: string }) =>
      adminRejectVideo(videoId, { reason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "video"] });
      setRejectTarget(null);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("selected");
          return next;
        },
        { replace: true },
      );
    },
  });

  const items = (data?.items ?? []).map(toVideoModerationView);
  const cursorError = isCursorResetError(error);
  const selectedVideo = items.find((v) => v.videoId === selected) ?? null;

  const columns: DataTableColumn<VideoModerationView>[] = [
    { id: "videoId", header: "Video ID", cell: (row) => row.videoId },
    {
      id: "uploaderName",
      header: "Uploader",
      cell: (row) => row.uploaderName ?? "—",
    },
    {
      id: "nsfwScore",
      header: "NSFW",
      cell: (row) => {
        const v = row.nsfwScore;
        return v == null ? "—" : v.toFixed(2);
      },
    },
    {
      id: "durationSeconds",
      header: "Duration (s)",
      cell: (row) => row.durationSeconds ?? "—",
    },
    { id: "status", header: "Status", cell: (row) => row.status },
  ];

  const handleSelect = (id: string | null) => {
    setSearchParams(
      (prev) => {
        const url = new URLSearchParams(prev);
        if (id === null) url.delete("selected");
        else url.set("selected", id);
        return url;
      },
      { replace: true },
    );
  };

  return (
    <PageContainer density="compact">
      <PageHeader title={t("admin.videoModeration.title") ?? "Video Moderation"} />

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
          {t("admin.queue.loading")}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-border bg-card px-5 py-8 text-center text-sm text-red-600 dark:text-red-400">
          {cursorError ? (
            <button type="button" onClick={cursorPagination.reset}>
              Reset cursor
            </button>
          ) : (
            t("admin.queue.loadErr")
          )}
        </div>
      ) : items.length === 0 ? (
        <EmptyState title={t("admin.queue.empty")} description="" icon={null} />
      ) : (
        <>
          <DataTable
            rows={items}
            columns={columns}
            rowKey={(row) => row.videoId}
            selectedId={selected ?? undefined}
            onRowOpen={(row) => handleSelect(row.videoId)}
            caption={t("admin.videoModeration.title") ?? "Video Moderation"}
            empty={null}
          />
          <CursorPagination
            itemCount={items.length}
            pageIndex={cursorPagination.pageIndex}
            pageSize={cursorPagination.pageSize}
            hasPrevious={cursorPagination.hasPrevious}
            hasMore={data?.hasMore ?? false}
            isFetching={isFetching}
            onPrevious={cursorPagination.goBack}
            onNext={() => cursorPagination.advance(data?.nextCursor ?? null)}
            onRefresh={() =>
              void queryClient.invalidateQueries({
                queryKey: ["admin", "video", "moderation", "cursor"],
              })
            }
            onPageSizeChange={cursorPagination.setPageSize}
          />
        </>
      )}

      <VideoPreviewDrawer
        video={selectedVideo}
        onClose={() => handleSelect(null)}
        onApprove={(videoId) => approveMutation.mutate(videoId)}
        onReject={(videoId) => setRejectTarget({ videoId, variant: "reject" })}
        isMutating={approveMutation.isPending || rejectMutation.isPending}
        approveLabel={t("admin.videoModeration.approve") ?? "Approve"}
        rejectLabel={t("admin.videoModeration.reject") ?? "Reject"}
      />

      {rejectTarget?.variant === "reject" ? (
        <VideoDecisionDialog
          variant="reject"
          videoId={rejectTarget.videoId}
          onConfirm={({ reason }) =>
            rejectMutation.mutate({ videoId: rejectTarget.videoId, reason })
          }
          onCancel={() => setRejectTarget(null)}
          isPending={rejectMutation.isPending}
        />
      ) : null}
    </PageContainer>
  );
}
