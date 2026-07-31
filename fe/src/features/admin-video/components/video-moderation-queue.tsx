import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import {
  adminApproveVideo,
  adminRejectVideo,
} from "@/shared/api/endpoints/admin";
import { DataTable } from "@/shared/ui/data-table";
import { EmptyState } from "@/shared/ui/empty-state";
import { PageContainer } from "@/shared/ui/page-container";
import { PageHeader } from "@/shared/ui/page-header";
import { Pagination } from "@/shared/ui/pagination";

import { adminVideoModerationQueryOptions } from "../api/query-options";
import {
  toVideoModerationView,
  type VideoModerationView,
} from "../model/video-queue-view";

import { VideoDecisionDialog } from "./video-decision-dialog";
import { VideoPreviewDrawer } from "./video-preview-drawer";

const helper = createColumnHelper<VideoModerationView>();

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

  const page = Number.parseInt(searchParams.get("page") ?? "1", 10) || 1;
  const selected = searchParams.get("selected");

  const { data, isLoading, isError } = useQuery(
    adminVideoModerationQueryOptions({ page }),
  );

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

  const items = (data?.content ?? []).map(toVideoModerationView);
  const selectedVideo = items.find((v) => v.videoId === selected) ?? null;

  const columns: ColumnDef<VideoModerationView>[] = [
    helper.accessor("videoId", { header: "Video ID" }),
    helper.accessor("uploaderName", {
      header: "Uploader",
      cell: (info) => info.getValue() ?? "—",
    }),
    helper.accessor("nsfwScore", {
      header: "NSFW",
      cell: (info) => {
        const v = info.getValue();
        return v == null ? "—" : v.toFixed(2);
      },
    }),
    helper.accessor("durationSeconds", {
      header: "Duration (s)",
      cell: (info) => info.getValue() ?? "—",
    }),
    helper.accessor("status", { header: "Status" }),
  ];

  const handlePageChange = (next: number) => {
    setSearchParams(
      (prev) => {
        const url = new URLSearchParams(prev);
        url.set("page", String(next));
        return url;
      },
      { replace: true },
    );
  };

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
      <PageHeader
        title={t("admin.videoModeration.title") ?? "Video Moderation"}
      />

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
          {t("admin.queue.loading")}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-border bg-card px-5 py-8 text-center text-sm text-red-600 dark:text-red-400">
          {t("admin.queue.loadErr")}
        </div>
      ) : items.length === 0 ? (
        <EmptyState title={t("admin.queue.empty")} />
      ) : (
        <>
          <DataTable
            rows={items}
            columns={columns}
            selectedId={selected}
            onRowOpen={handleSelect}
            selection="single"
          />
          <Pagination
            page={page}
            totalPages={data?.totalPages ?? 0}
            totalElements={data?.totalElements ?? 0}
            onPageChange={handlePageChange}
          />
        </>
      )}

      <VideoPreviewDrawer
        video={selectedVideo}
        onClose={() => handleSelect(null)}
        onApprove={(videoId) => approveMutation.mutate(videoId)}
        onReject={(videoId) =>
          setRejectTarget({ videoId, variant: "reject" })
        }
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