/**
 * UI-facing view of an admin payout row.
 *
 * Plan 06 Task 4 — the FE must keep every wire-status distinct (no PENDING→REQUESTED
 * or COMPLETED→PAID collapsing). The matrix in `features/admin/model/queue-capabilities.ts`
 * is keyed on these exact strings.
 */

import type { AdminPayout, PayoutStatus } from "@/shared/contracts/api";

/**
 * All 12 wire statuses from the seller-finance-service Payout.status enum.
 * `parsePayoutStatus` in `@/shared/contracts/domain-enums` is the legacy
 * collapsing parser (PENDING→REQUESTED, COMPLETED→PAID) and is NOT used here.
 */
export const PAYOUT_STATUSES = [
  "REQUESTED",
  "APPROVED",
  "SUBMITTING",
  "SUBMITTED",
  "PAID",
  "UNKNOWN",
  "REJECTED",
  "CANCELLED",
  "REVERSED",
  "PENDING",
  "COMPLETED",
  "FAILED",
] as const satisfies readonly PayoutStatus[];

export interface PayoutView {
  id: string;
  sellerId: string;
  sellerName: string | null;
  amount: number;
  currency: string;
  status: PayoutStatus;
  requestedAt: string | null;
  completedBy: string | null;
  completedAt: string | null;
  approvedBy: string | null;
  paidBy: string | null;
  externalReference: string | null;
  evidenceReference: string | null;
  idempotencyKey: string | null;
}

export function toPayoutView(raw: AdminPayout): PayoutView {
  return {
    id: raw.id,
    sellerId: raw.sellerId,
    sellerName: raw.sellerName ?? null,
    amount: raw.amount,
    currency: raw.currency ?? "VND",
    status: raw.status,
    requestedAt: raw.requestedAt ?? null,
    completedBy: raw.completedBy ?? null,
    completedAt: raw.completedAt ?? null,
    approvedBy: raw.approvedBy ?? null,
    paidBy: raw.paidBy ?? null,
    externalReference: raw.externalReference ?? null,
    evidenceReference: raw.evidenceReference ?? null,
    idempotencyKey: raw.idempotencyKey ?? null,
  };
}

export function isPayoutStatus(value: string): value is PayoutStatus {
  return (PAYOUT_STATUSES as readonly string[]).includes(value);
}

/**
 * Action matrix. The BE has no `begin-submission` endpoint — to land in
 * SUBMITTING the operator must submit; to move on from SUBMITTING/SUBMITTED
 * they confirm paid or report unknown. APPROVED cannot submit because there
 * is no transition path exposed to flip APPROVED → SUBMITTING.
 */
export interface PayoutActions {
  canApprove: boolean;
  canReject: boolean;
  canSubmit: boolean;
  canUnknown: boolean;
  canPaid: boolean;
  canLegacyComplete: boolean;
  canLegacyFail: boolean;
}

export interface PayoutActionOptions {
  /** Current admin id (used for separation-of-duties). */
  currentAdminId?: string | null;
  /** Admin who approved the payout (BE audit trail). */
  approvedBy?: string | null;
}

/**
 * Separation-of-duties: an admin who approved a payout cannot also mark it
 * paid. The audit trail's `approvedBy` is the source of truth; we still
 * gate it on `currentAdminId` so the same admin never holds both sides.
 */
function isSelfApprover(options: PayoutActionOptions): boolean {
  const { approvedBy, currentAdminId } = options;
  if (!approvedBy || !currentAdminId) return false;
  return approvedBy === currentAdminId;
}

export function payoutActionsFor(
  status: PayoutStatus,
  options: PayoutActionOptions = {},
): PayoutActions {
  const selfApprover = isSelfApprover(options);

  switch (status) {
    case "REQUESTED":
      return {
        canApprove: true,
        canReject: true,
        canSubmit: false,
        canUnknown: false,
        canPaid: false,
        canLegacyComplete: false,
        canLegacyFail: false,
      };
    case "APPROVED":
      return {
        canApprove: false,
        canReject: true,
        canSubmit: false,
        canUnknown: false,
        canPaid: false,
        canLegacyComplete: false,
        canLegacyFail: false,
      };
    case "SUBMITTING":
      return {
        canApprove: false,
        canReject: false,
        canSubmit: true,
        canUnknown: true,
        canPaid: !selfApprover,
        canLegacyComplete: false,
        canLegacyFail: false,
      };
    case "SUBMITTED":
      return {
        canApprove: false,
        canReject: false,
        canSubmit: false,
        canUnknown: true,
        canPaid: !selfApprover,
        canLegacyComplete: false,
        canLegacyFail: false,
      };
    case "UNKNOWN":
      return {
        canApprove: false,
        canReject: false,
        canSubmit: false,
        canUnknown: false,
        canPaid: !selfApprover,
        canLegacyComplete: false,
        canLegacyFail: false,
      };
    case "PENDING":
      return {
        canApprove: true,
        canReject: true,
        canSubmit: false,
        canUnknown: false,
        canPaid: false,
        canLegacyComplete: true,
        canLegacyFail: true,
      };
    case "PAID":
    case "REJECTED":
    case "CANCELLED":
    case "REVERSED":
    case "COMPLETED":
    case "FAILED":
      return {
        canApprove: false,
        canReject: false,
        canSubmit: false,
        canUnknown: false,
        canPaid: false,
        canLegacyComplete: false,
        canLegacyFail: false,
      };
  }
}
