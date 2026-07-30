import { IconCircleCheck, IconSearch, IconStar, IconCircleX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { FormDialog } from "../../components/form-dialog";
import { ApiError } from "@/shared/api";
import {
  adminApproveReview,
  adminPendingReviews,
  adminRejectReview,
} from "@/shared/api/endpoints/admin";

const REVIEW_STAR_POSITIONS = [1, 2, 3, 4, 5];

export function ReviewsModeration() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const reviewsQuery = useQuery({
    queryKey: ["admin", "reviews", "pending", appliedSearch],
    queryFn: () => adminPendingReviews({ q: appliedSearch || undefined }),
    retry: false,
  });

  const approve = useMutation({
    mutationFn: (id: string) => adminApproveReview(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "reviews"] });
      toast.success(t("admin.reviewsModeration.approveOk"));
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
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("admin.reviewsModeration.rejectErr")),
  });

  const reviews = reviewsQuery.data ?? [];

  return (
    <div className="space-y-5">
      <FormDialog
        open={!!rejectFor}
        title={t("admin.reviewsModeration.rejectDialog.title")}
        submitLabel={t("admin.reviewsModeration.rejectDialog.submit")}
        submitColor="var(--error)"
        fields={[
          {
            key: "reason",
            label: t("admin.reviewsModeration.rejectDialog.reasonLabel"),
            placeholder: t("admin.reviewsModeration.rejectDialog.reasonPlaceholder"),
            type: "textarea",
            required: true,
          },
        ]}
        onClose={() => setRejectFor(null)}
        onSubmit={({ reason }) => {
          if (rejectFor) reject.mutate({ id: rejectFor, reason });
        }}
        isSubmitting={reject.isPending}
      />
      <h2 className="text-xl font-bold text-foreground">{t("admin.reviewsModeration.title")}</h2>

      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setAppliedSearch(search.trim());
        }}
      >
        <IconSearch size={16} className="text-muted-foreground" aria-hidden="true" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("admin.reviewsModeration.searchPlaceholder")}
          aria-label={t("admin.reviewsModeration.searchPlaceholder")}
          className="h-10 flex-1 rounded-lg border border-border bg-card px-3 text-sm text-foreground"
        />
      </form>

      {reviewsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("admin.reviewsModeration.loading")}</p>
      ) : null}
      {reviewsQuery.error instanceof ApiError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{reviewsQuery.error.message}</p>
      ) : null}
      {!reviewsQuery.isLoading && reviews.length === 0 ? (
        <div className="bg-card rounded-2xl p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">{t("admin.reviewsModeration.empty")}</p>
        </div>
      ) : null}

      <div className="space-y-3">
        {reviews.map((r) => (
          <div key={r.id} className="bg-card rounded-2xl p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-xs font-mono text-muted-foreground">
                  {r.productName ?? t("admin.reviewsModeration.productPrefix", { id: r.productId })}
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {r.userName ?? r.userId ?? t("admin.reviewsModeration.anonGuest")}
                </p>
              </div>
              <div className="flex items-center gap-0.5">
                {REVIEW_STAR_POSITIONS.map((position) => (
                  <IconStar
                    key={position}
                    size={14}
                    fill={position <= r.rating ? "var(--warning)" : "var(--border)"}
                    className={position <= r.rating ? "text-amber-400" : "text-gray-200"}
                  />
                ))}
              </div>
            </div>
            {r.comment ? (
              <p className="text-sm text-foreground mb-3 bg-muted p-3 rounded-xl">{r.comment}</p>
            ) : null}
            <div className="flex gap-2">
              <button
                onClick={() => approve.mutate(r.id)}
                disabled={approve.isPending}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                style={{ background: "var(--success)" }}
              >
                <IconCircleCheck size={13} /> {t("admin.reviewsModeration.approve")}
              </button>
              <button
                onClick={() => setRejectFor(r.id)}
                disabled={reject.isPending}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 text-red-500 disabled:opacity-50"
              >
                <IconCircleX size={13} /> {t("admin.reviewsModeration.reject")}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
