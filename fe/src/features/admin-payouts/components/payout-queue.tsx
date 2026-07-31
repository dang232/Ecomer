import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { AdminQueueFrame } from "@/features/admin/components/admin-queue-frame";
import { ADMIN_QUEUE_CAPABILITIES } from "@/features/admin/model/queue-capabilities";
import { ApiError } from "@/shared/api";
import {
  adminApprovePayout,
  adminCompleteLegacyPayout,
  adminFailLegacyPayout,
  adminPaidPayout,
  adminRejectPayout,
  adminSubmitPayout,
  adminUnknownPayout,
} from "@/shared/api/endpoints/admin";
import type { PayoutStatus } from "@/shared/contracts/api";
import { formatPrice } from "@/shared/lib";

import { adminPayoutsQueryOptions } from "../api/query-options";
import {
  payoutActionsFor,
  toPayoutView,
  type PayoutActions,
  type PayoutView,
} from "../model/payout-view";

import {
  PayoutDecisionDialog,
  type PayoutDecisionDialogProps,
  type PayoutDecisionVariant,
} from "./payout-decision-dialog";

interface PayoutQueueProps {
  q: string;
  status: string;
  selected: string | null;
  onSearch: (q: string) => void;
  onStatusChange: (status: string) => void;
  onSelect: (id: string | null) => void;
  /** Pulled from the auth store / session for the separation-of-duties check. */
  currentAdminId?: string | null;
}

export function PayoutQueue({
  q,
  status,
  selected,
  onSearch,
  onStatusChange,
  onSelect,
  currentAdminId,
}: PayoutQueueProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [dialog, setDialog] = useState<{
    variant: PayoutDecisionVariant;
    payout: PayoutView;
  } | null>(null);

  const { data, isLoading, isError } = useQuery(
    adminPayoutsQueryOptions({
      status: status || undefined,
      q: q || undefined,
      page: 0,
      size: 50,
    }),
  );
  const rows: PayoutView[] = (data?.content ?? []).map(toPayoutView);
  const selectedRow = selected ? rows.find((r) => r.id === selected) ?? null : null;

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin", "payouts"] });
  };

  const mutation = useMutation({
    mutationFn: async (args: {
      variant: PayoutDecisionVariant;
      payout: PayoutView;
      values: Parameters<PayoutDecisionDialogProps["onConfirm"]>[0];
    }) => {
      const { variant, payout, values } = args;
      switch (variant) {
        case "approve":
          return adminApprovePayout(payout.id, values.reason);
        case "reject":
          return adminRejectPayout(payout.id, values.reason);
        case "submit":
          return adminSubmitPayout(
            payout.id,
            values.providerReference ?? "",
            values.attemptId ?? "",
          );
        case "unknown":
          return adminUnknownPayout(payout.id, values.reason);
        case "paid":
          return adminPaidPayout(
            payout.id,
            values.providerReference ?? "",
            values.evidence ?? "",
          );
        case "legacy-complete":
          return adminCompleteLegacyPayout(payout.id, {
            reason: values.reason,
            externalReference: values.externalReference ?? "",
            evidenceHash: values.evidenceHash ?? "",
            maskedDestinationConfirmed: true,
          });
        case "legacy-fail":
          return adminFailLegacyPayout(payout.id, {
            reason: values.reason,
            evidence: {
              externalReference: values.externalReference,
              evidenceHash: values.evidenceHash,
            },
          });
      }
    },
    onSuccess: (_, vars) => {
      invalidate();
      toast.success(
        t(`admin.payouts.toast.${vars.variant}.ok`, { defaultValue: "Action recorded" }),
      );
      setDialog(null);
    },
    onError: (err) => {
      invalidate();
      toast.error(err instanceof ApiError ? err.message : t("admin.payouts.updateErr"));
      setDialog(null);
    },
  });

  const columns = buildPayoutQueueColumns({
    t,
    currentAdminId: currentAdminId ?? null,
    isMutating: mutation.isPending,
    onAction: (variant, row) => setDialog({ variant, payout: row }),
  });

  return (
    <>
      <AdminQueueFrame
        title={t("admin.payouts.title")}
        description={t("admin.payouts.subtitle", { defaultValue: "" })}
        capabilities={ADMIN_QUEUE_CAPABILITIES.payouts}
        q={q}
        status={status}
        sort=""
        onSearch={onSearch}
        onStatusChange={onStatusChange}
        onSortChange={undefined}
        selectedId={selected}
        onSelect={onSelect}
        rows={rows}
        columns={columns}
        isLoading={isLoading}
        isError={isError}
        pagination={undefined}
        onPageChange={() => undefined}
        drawerTitle={selectedRow?.id ?? ""}
        drawerDescription={
          selectedRow
            ? `${formatPrice(selectedRow.amount)} ${selectedRow.currency} · ${selectedRow.status}`
            : undefined
        }
      >
        {selectedRow ? <PayoutDrawerBody row={selectedRow} /> : null}
      </AdminQueueFrame>

      {dialog ? (
        <PayoutDecisionDialog
          variant={dialog.variant}
          payoutId={dialog.payout.id}
          sellerLabel={dialog.payout.sellerName}
          amountLabel={formatPrice(dialog.payout.amount)}
          isPending={mutation.isPending}
          onConfirm={(values) =>
            mutation.mutate({ variant: dialog.variant, payout: dialog.payout, values })
          }
          onCancel={() => setDialog(null)}
        />
      ) : null}
    </>
  );
}

function PayoutDrawerBody({ row }: { row: PayoutView }) {
  return (
    <div className="space-y-3 text-sm">
      <DrawerRow label="Seller" value={row.sellerName ?? row.sellerId} />
      <DrawerRow label="Amount" value={`${formatPrice(row.amount)} ${row.currency}`} />
      <DrawerRow label="Status" value={row.status} />
      <DrawerRow label="Requested at" value={row.requestedAt ?? "—"} />
      {row.completedAt ? <DrawerRow label="Completed at" value={row.completedAt} /> : null}
      {row.completedBy ? <DrawerRow label="Completed by" value={row.completedBy} /> : null}
      {row.approvedBy ? <DrawerRow label="Approved by" value={row.approvedBy} /> : null}
      {row.paidBy ? <DrawerRow label="Paid by" value={row.paidBy} /> : null}
      {row.externalReference ? (
        <DrawerRow label="External reference" value={row.externalReference} />
      ) : null}
      {row.evidenceReference ? (
        <DrawerRow label="Evidence reference" value={row.evidenceReference} />
      ) : null}
      {row.idempotencyKey ? <DrawerRow label="Idempotency key" value={row.idempotencyKey} /> : null}
    </div>
  );
}

function DrawerRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs">{value}</span>
    </div>
  );
}

interface ColumnProps {
  t: TFunction;
  currentAdminId: string | null;
  isMutating: boolean;
  onAction: (variant: PayoutDecisionVariant, row: PayoutView) => void;
}

function buildPayoutQueueColumns({
  t,
  currentAdminId,
  isMutating,
  onAction,
}: ColumnProps): ColumnDef<PayoutView>[] {
  return [
    {
      accessorKey: "id",
      header: t("admin.payouts.th.id") ?? "Payout #",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.id}</span>,
    },
    {
      accessorKey: "sellerName",
      header: t("admin.payouts.th.seller") ?? "Seller",
      cell: ({ row }) => row.original.sellerName ?? row.original.sellerId,
    },
    {
      accessorKey: "amount",
      header: t("admin.payouts.th.amount") ?? "Amount",
      cell: ({ row }) => `${formatPrice(row.original.amount)} ${row.original.currency}`,
    },
    {
      accessorKey: "status",
      header: t("admin.payouts.th.status") ?? "Status",
      cell: ({ row }) => <StatusChip status={row.original.status} />,
    },
    {
      accessorKey: "requestedAt",
      header: t("admin.payouts.th.requestedAt") ?? "Requested",
      cell: ({ row }) =>
        row.original.requestedAt ? new Date(row.original.requestedAt).toLocaleDateString() : "—",
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <PayoutActionCell
          row={row.original}
          t={t}
          currentAdminId={currentAdminId}
          approvedBy={row.original.approvedBy}
          isMutating={isMutating}
          onAction={onAction}
        />
      ),
    },
  ];
}

function PayoutActionCell({
  row,
  t,
  currentAdminId,
  approvedBy,
  isMutating,
  onAction,
}: {
  row: PayoutView;
  t: TFunction;
  currentAdminId: string | null;
  approvedBy: string | null;
  isMutating: boolean;
  onAction: (variant: PayoutDecisionVariant, row: PayoutView) => void;
}) {
  const actions: PayoutActions = payoutActionsFor(row.status, {
    currentAdminId,
    approvedBy,
  });
  const buttons: { variant: PayoutDecisionVariant; label: string; tone: "default" | "danger" | "primary" }[] = [];
  if (actions.canApprove) {
    buttons.push({ variant: "approve", label: t("admin.payouts.action.approve") ?? "Approve", tone: "primary" });
  }
  if (actions.canReject) {
    buttons.push({ variant: "reject", label: t("admin.payouts.action.reject") ?? "Reject", tone: "danger" });
  }
  if (actions.canSubmit) {
    buttons.push({ variant: "submit", label: t("admin.payouts.action.submit") ?? "Submit", tone: "primary" });
  }
  if (actions.canUnknown) {
    buttons.push({ variant: "unknown", label: t("admin.payouts.action.unknown") ?? "Unknown", tone: "default" });
  }
  if (actions.canPaid) {
    buttons.push({ variant: "paid", label: t("admin.payouts.action.paid") ?? "Paid", tone: "primary" });
  }
  if (actions.canLegacyComplete) {
    buttons.push({
      variant: "legacy-complete",
      label: t("admin.payouts.action.legacyComplete") ?? "Complete",
      tone: "primary",
    });
  }
  if (actions.canLegacyFail) {
    buttons.push({
      variant: "legacy-fail",
      label: t("admin.payouts.action.legacyFail") ?? "Fail",
      tone: "danger",
    });
  }

  if (buttons.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {buttons.map((b) => (
        <button
          key={b.variant}
          type="button"
          disabled={isMutating}
          onClick={() => onAction(b.variant, row)}
          className={
            b.tone === "danger"
              ? "rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-50 disabled:opacity-50"
              : b.tone === "primary"
                ? "rounded-lg bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                : "rounded-lg border border-border px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
          }
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}

function StatusChip({ status }: { status: PayoutStatus }) {
  const map: Record<PayoutStatus, string> = {
    REQUESTED: "bg-yellow-100 text-yellow-700",
    APPROVED: "bg-blue-100 text-blue-700",
    SUBMITTING: "bg-indigo-100 text-indigo-700",
    SUBMITTED: "bg-indigo-100 text-indigo-700",
    PAID: "bg-emerald-100 text-emerald-700",
    UNKNOWN: "bg-orange-100 text-orange-700",
    REJECTED: "bg-red-100 text-red-700",
    CANCELLED: "bg-gray-200 text-gray-700",
    REVERSED: "bg-purple-100 text-purple-700",
    PENDING: "bg-amber-100 text-amber-700",
    COMPLETED: "bg-emerald-100 text-emerald-700",
    FAILED: "bg-red-100 text-red-700",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-bold ${map[status]}`}>{status}</span>
  );
}
