import { IconStar } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ApiError } from "@/shared/api";
import {
  adminApproveReview,
  adminRejectReview,
} from "@/shared/api/endpoints/admin";

import { ADMIN_QUEUE_CAPABILITIES } from "../../admin";
import { AdminQueueFrame } from "../../admin/components/admin-queue-frame";
import { adminReviewsQueryOptions } from "../api/query-options";
import type { ReviewView } from "../model/review-view";
import { toReviewView } from "../model/review-view";

import { ReviewDecisionDialog } from "./review-decision-dialog";

interface ReviewModerationQueueProps {
  q: string;
  selected: string | null;
  onSearch: (q: string) => void;
  onSelect: (id: string | null) => void;
}

const STAR_POSITIONS = [1, 2, 3, 4, 5] as const;

export function ReviewModerationQueue({
  q,
  selected,
  onSearch,
  onSelect,
}: ReviewModerationQueueProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [rejectFor, setRejectFor] = useState<string | null>(null);

  const { data: reviewsRaw, isLoading, isError } = useQuery(
    adminReviewsQueryOptions({ q }),
  );
  const reviews: ReviewView[] = (reviewsRaw ?? []).map(toReviewView);

  const approve = useMutation({
    mutationFn: (id: string) => adminApproveReview(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "reviews"] });
      toast.success(t("admin.reviewsModeration.approveOk"));
      onSelect(null);
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("admin.reviewsModeration.approveErr")),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminRejectReview(id, { reason }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "reviews"] });
      toast.success(t("admin.reviewsModeration.rejectOk"));
      setRejectFor(null);
      onSelect(null);
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("admin.reviewsModeration.rejectErr")),
  });

  const isMutating = approve.isPending || reject.isPending;
  const selectedReview = selected ? reviews.find((r) => r.id === selected) ?? null : null;

  const columns: ColumnDef<ReviewView>[] = [
    {
      accessorKey: "productName",
      header: t("admin.reviewsModeration.productPrefix", { id: "" }) ?? "Product",
      cell: ({ row }) => (
        <span className="text-sm font-semibold text-foreground">
          {row.original.productName ??
            t("admin.reviewsModeration.productPrefix", { id: row.original.productId })}
        </span>
      ),
    },
    {
      accessorKey: "userName",
      header: t("admin.reviewsModeration.anonGuest") ?? "User",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.userName ?? row.original.userId ?? t("admin.reviewsModeration.anonGuest")}
        </span>
      ),
    },
    {
      accessorKey: "rating",
      header: t("admin.reviewsModeration.anonGuest") ?? "Rating",
      cell: ({ row }) => <Stars rating={row.original.rating} />,
    },
    {
      accessorKey: "comment",
      header: t("admin.reviewsModeration.commentLabel") ?? "Comment",
      cell: ({ row }) =>
        row.original.comment ? (
          <span className="line-clamp-1 text-xs text-muted-foreground">
            {row.original.comment}
          </span>
        ) : (
          "—"
        ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                approve.mutate(r.id);
              }}
              disabled={isMutating}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--success)" }}
            >
              {t("admin.reviewsModeration.approve")}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setRejectFor(r.id);
              }}
              disabled={isMutating}
              className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-500 disabled:opacity-50"
            >
              {t("admin.reviewsModeration.reject")}
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <AdminQueueFrame
        title={t("admin.reviewsModeration.title") ?? "Review moderation"}
        capabilities={ADMIN_QUEUE_CAPABILITIES.reviews}
        q={q}
        status=""
        sort=""
        onSearch={onSearch}
        onStatusChange={() => undefined}
        onSortChange={() => undefined}
        selectedId={selected}
        onSelect={onSelect}
        rows={reviews}
        columns={columns}
        isLoading={isLoading}
        isError={isError}
        onPageChange={() => undefined}
        drawerTitle={selectedReview?.productName ?? selectedReview?.id ?? ""}
        drawerDescription={selectedReview?.userName ?? undefined}
      >
        {selectedReview ? (
          <div className="space-y-3">
            <Stars rating={selectedReview.rating} />
            {selectedReview.comment ? (
              <p className="rounded-xl bg-muted p-3 text-sm text-foreground">
                {selectedReview.comment}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">—</p>
            )}
          </div>
        ) : null}
      </AdminQueueFrame>

      {rejectFor ? (
        <ReviewDecisionDialog
          reviewId={rejectFor}
          isPending={reject.isPending}
          onConfirm={({ reason }) => reject.mutate({ id: rejectFor, reason })}
          onCancel={() => setRejectFor(null)}
        />
      ) : null}
    </>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`Rating ${rating} of 5`}>
      {STAR_POSITIONS.map((position) => (
        <IconStar
          key={position}
          size={14}
          fill={position <= rating ? "var(--warning)" : "var(--border)"}
          className={position <= rating ? "text-amber-400" : "text-gray-200"}
        />
      ))}
    </div>
  );
}