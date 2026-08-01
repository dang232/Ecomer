import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ADMIN_QUEUE_CAPABILITIES, AdminQueueFrame } from "@/features/admin";
import { ApiError } from "@/shared/api";
import { adminOpenDisputes, adminResolveDispute } from "@/shared/api/endpoints/admin";
import type { DataTableColumn } from "@/shared/ui/data-table";

import { toDisputeView } from "../model/dispute-view";
import type { DisputeView } from "../model/dispute-view";

import { DisputeResolutionDialog } from "./dispute-resolution-dialog";

interface DisputeQueueProps {
  q: string;
  selected: string | null;
  onSearch: (q: string) => void;
  onSelect: (id: string | null) => void;
}

export function DisputeQueue({ q, selected, onSearch, onSelect }: DisputeQueueProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [resolveFor, setResolveFor] = useState<string | null>(null);

  const {
    data: disputesRaw,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["admin", "disputes", q],
    queryFn: () => adminOpenDisputes({ q: q || undefined }),
    retry: false,
  });
  const disputes: DisputeView[] = (disputesRaw ?? []).map(toDisputeView);

  const resolve = useMutation({
    mutationFn: ({ id, adminResolution }: { id: string; adminResolution: string }) =>
      adminResolveDispute(id, { adminResolution }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "disputes"] });
      toast.success(t("admin.disputes.resolveOk"));
      setResolveFor(null);
      onSelect(null);
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("admin.disputes.resolveErr")),
  });

  const selectedDispute = selected ? (disputes.find((d) => d.id === selected) ?? null) : null;

  const columns: DataTableColumn<DisputeView>[] = [
    {
      id: "orderNumber",
      header: t("admin.disputes.orderLabel", { id: "" }) ?? "Order",
      cell: (row) => (
        <span className="text-sm font-semibold text-foreground">
          {t("admin.disputes.orderLabel", {
            id: row.orderNumber ?? row.returnId,
          })}
        </span>
      ),
    },
    {
      id: "buyerName",
      header: t("admin.disputes.buyerFallback") ?? "Buyer",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.buyerName ?? t("admin.disputes.buyerFallback")}
          {row.sellerName ? ` · ${row.sellerName}` : ""}
        </span>
      ),
    },
    {
      id: "status",
      header: t("admin.disputes.resolveDialog.title") ?? "Status",
      cell: (row) => <StatusChip status={row.status} />,
    },
    {
      id: "actions",
      header: "",
      cell: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setResolveFor(row.id);
          }}
          disabled={resolve.isPending}
          className="rounded-lg px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--primary)" }}
        >
          {t("admin.disputes.resolve")}
        </button>
      ),
    },
  ];

  return (
    <>
      <AdminQueueFrame
        title={t("admin.disputes.title") ?? "Disputes"}
        capabilities={ADMIN_QUEUE_CAPABILITIES.disputes}
        q={q}
        status=""
        sort=""
        onSearch={onSearch}
        onStatusChange={() => undefined}
        onSortChange={() => undefined}
        selectedId={selected}
        onSelect={onSelect}
        rows={disputes}
        columns={columns}
        isLoading={isLoading}
        isError={isError}
        onPageChange={() => undefined}
        drawerTitle={selectedDispute ? `Dispute ${selectedDispute.id}` : ""}
        drawerDescription={selectedDispute?.orderNumber ?? undefined}
      >
        {selectedDispute?.description ? (
          <div className="space-y-3">
            <p className="rounded-xl bg-muted p-3 text-sm text-foreground">
              {selectedDispute.description}
            </p>
            {selectedDispute.sellerResponse ? (
              <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
                {selectedDispute.sellerResponse}
              </p>
            ) : null}
          </div>
        ) : null}
      </AdminQueueFrame>

      {resolveFor ? (
        <DisputeResolutionDialog
          disputeId={resolveFor}
          isPending={resolve.isPending}
          onConfirm={({ adminResolution }) => resolve.mutate({ id: resolveFor, adminResolution })}
          onCancel={() => setResolveFor(null)}
        />
      ) : null}
    </>
  );
}

function StatusChip({ status }: { status: string }) {
  const isOpen = status === "OPEN";
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        isOpen ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
      }`}
    >
      {status}
    </span>
  );
}
