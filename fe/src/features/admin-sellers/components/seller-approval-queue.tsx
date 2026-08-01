import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ADMIN_QUEUE_CAPABILITIES, AdminQueueFrame } from "@/features/admin";
import { ApiError } from "@/shared/api";
import { adminApproveSeller, adminRejectSeller } from "@/shared/api/endpoints/admin";
import { formatRelativeTime } from "@/shared/lib";
import type { DataTableColumn } from "@/shared/ui/data-table";

import { adminSellersQueryOptions } from "../api/query-options";
import type { SellerView } from "../model/seller-view";
import { toSellerView } from "../model/seller-view";

import { SellerApplicationDrawer } from "./seller-application-drawer";
import { SellerDecisionDialog } from "./seller-decision-dialog";

interface SellerApprovalQueueProps {
  q: string;
  selected: string | null;
  onSearch: (q: string) => void;
  onSelect: (id: string | null) => void;
}

export function SellerApprovalQueue({ q, selected, onSearch, onSelect }: SellerApprovalQueueProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<{
    variant: "approve" | "reject";
    sellerId: string;
    shopName?: string | null;
  } | null>(null);

  const { data: sellersRaw, isLoading, isError } = useQuery(adminSellersQueryOptions({ q }));
  const sellers: SellerView[] = (sellersRaw ?? []).map(toSellerView);

  const approve = useMutation({
    mutationFn: (id: string) => adminApproveSeller(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "sellers"] });
      toast.success(t("admin.sellers.approveOk"));
      setDialog(null);
      onSelect(null);
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("admin.sellers.approveErr")),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminRejectSeller(id, { reason }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "sellers"] });
      toast.success(t("admin.sellers.rejectOk"));
      setDialog(null);
      onSelect(null);
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("admin.sellers.rejectErr")),
  });

  const isMutating = approve.isPending || reject.isPending;

  const selectedSeller = selected ? (sellers.find((s) => s.id === selected) ?? null) : null;

  const columns: DataTableColumn<SellerView>[] = [
    {
      id: "shopName",
      header: t("admin.sellers.applicationDialog.shopName") ?? "Shop",
      cell: (row) => <span className="text-sm font-semibold text-foreground">{row.shopName}</span>,
    },
    {
      id: "status",
      header: t("admin.sellers.applicationDialog.status") ?? "Status",
      cell: (row) => <StatusChip seller={row} />,
    },
    {
      id: "appliedAt",
      header: t("admin.sellers.rowApplied", { relativeTime: "" }) ?? "Applied",
      cell: (row) => (row.appliedAt ? formatRelativeTime(row.appliedAt) : "—"),
    },
    {
      id: "actions",
      header: "",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDialog({ variant: "approve", sellerId: row.id, shopName: row.shopName });
            }}
            disabled={isMutating || row.approved}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--primary)" }}
          >
            {t("admin.sellers.approve")}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDialog({ variant: "reject", sellerId: row.id, shopName: row.shopName });
            }}
            disabled={isMutating || row.approved}
            className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-500 disabled:opacity-50"
          >
            {t("admin.sellers.reject")}
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <AdminQueueFrame
        title={t("admin.sellers.title") ?? "Approve Sellers"}
        capabilities={ADMIN_QUEUE_CAPABILITIES.sellers}
        q={q}
        status=""
        sort=""
        onSearch={onSearch}
        onStatusChange={() => undefined}
        onSortChange={() => undefined}
        selectedId={selected}
        onSelect={onSelect}
        rows={sellers}
        columns={columns}
        isLoading={isLoading}
        isError={isError}
        onPageChange={() => undefined}
        drawerTitle={selectedSeller?.shopName ?? ""}
        drawerDescription={selectedSeller?.status}
      >
        <SellerApplicationDrawer
          seller={selectedSeller}
          onApprove={(id) =>
            setDialog({ variant: "approve", sellerId: id, shopName: selectedSeller?.shopName })
          }
          isApproving={approve.isPending}
        />
      </AdminQueueFrame>

      {dialog ? (
        <SellerDecisionDialog
          variant={dialog.variant}
          sellerId={dialog.sellerId}
          shopName={dialog.shopName}
          isPending={approve.isPending || reject.isPending}
          onConfirm={(input) => {
            if (dialog.variant === "approve") {
              approve.mutate(dialog.sellerId);
            } else if (input.reason) {
              reject.mutate({ id: dialog.sellerId, reason: input.reason });
            }
          }}
          onCancel={() => setDialog(null)}
        />
      ) : null}
    </>
  );
}

function StatusChip({ seller }: { seller: SellerView }) {
  const approved = seller.approved;
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={{
        background: approved ? "var(--success-light)" : "var(--warning-light)",
        color: approved ? "var(--success)" : "var(--warning)",
      }}
    >
      {seller.status}
    </span>
  );
}
