import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { adminApproveAppeal, adminRejectAppeal } from "@/shared/api/endpoints/admin";
import { DataTable, type DataTableColumn } from "@/shared/ui/data-table";
import { EmptyState } from "@/shared/ui/empty-state";
import { PageContainer } from "@/shared/ui/page-container";
import { PageHeader } from "@/shared/ui/page-header";
import { Pagination } from "@/shared/ui/pagination";

import { adminVideoAppealsQueryOptions } from "../api/query-options";
import { toVideoAppealView, type VideoAppealView } from "../model/video-queue-view";

import { VideoDecisionDialog } from "./video-decision-dialog";
import { VideoPreviewDrawer } from "./video-preview-drawer";

/**
 * Video appeal queue. URL owns `page` (1-based). Approving an appeal
 * re-publishes the video; rejecting makes the rejection final. Either action
 * invalidates the `["admin","video"]` family.
 */
export function VideoAppealsQueue() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Number.parseInt(searchParams.get("page") ?? "1", 10) || 1;
  const selected = searchParams.get("selected");

  const { data, isLoading, isError } = useQuery(adminVideoAppealsQueryOptions({ page }));

  const [rejectTarget, setRejectTarget] = useState<{
    videoId: string;
    variant: "reject" | "reject-appeal";
  } | null>(null);

  const approveMutation = useMutation({
    mutationFn: (videoId: string) => adminApproveAppeal(videoId),
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
      adminRejectAppeal(videoId, { reason }),
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

  const items = (data?.content ?? []).map(toVideoAppealView);
  // Convert appeal view → moderation view shape so the existing preview
  // drawer can consume it without duplicating the player surface.
  const selectedVideo = (() => {
    if (!selected) return null;
    const it = items.find((v) => v.videoId === selected);
    if (!it) return null;
    return {
      videoId: it.videoId,
      ownerId: null,
      productId: null,
      reviewId: null,
      status: it.status,
      rejectionReason: it.rejectionReason,
      posterUrl: it.posterUrl,
      durationSeconds: it.durationSeconds,
      uploaderName: it.uploaderName,
      nsfwScore: it.nsfwScore,
      createdAt: it.createdAt,
    };
  })();

  const columns: DataTableColumn<VideoAppealView>[] = [
    { id: "videoId", header: "Video ID", cell: (row) => row.videoId },
    {
      id: "uploaderName",
      header: "Uploader",
      cell: (row) => row.uploaderName ?? "—",
    },
    { id: "status", header: "Status", cell: (row) => row.status },
    {
      id: "appealReason",
      header: "Appeal Reason",
      cell: (row) => row.appealReason ?? "—",
    },
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
      <PageHeader title={t("admin.videoAppeals.title") ?? "Video Appeals"} />

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
          {t("admin.queue.loading")}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-border bg-card px-5 py-8 text-center text-sm text-red-600 dark:text-red-400">
          {t("admin.queue.loadErr")}
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
            caption={t("admin.videoAppeals.title") ?? "Video Appeals"}
            empty={null}
          />
          <Pagination
            page={page}
            pageCount={data?.totalPages ?? 0}
            onPageChange={handlePageChange}
          />
        </>
      )}

      <VideoPreviewDrawer
        video={selectedVideo}
        onClose={() => handleSelect(null)}
        onApprove={(videoId) => approveMutation.mutate(videoId)}
        onReject={(videoId) => setRejectTarget({ videoId, variant: "reject-appeal" })}
        isMutating={approveMutation.isPending || rejectMutation.isPending}
        approveLabel={t("admin.videoAppeals.approve") ?? "Approve Appeal"}
        rejectLabel={t("admin.videoAppeals.reject") ?? "Reject"}
      />

      {rejectTarget?.variant === "reject-appeal" ? (
        <VideoDecisionDialog
          variant="reject-appeal"
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
