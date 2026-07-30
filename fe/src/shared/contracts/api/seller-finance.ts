import { z } from "zod";

import { sellerIdSchema } from "@/shared/contracts/api/branded-ids";
import { parsePayoutStatus } from "@/shared/contracts";

// BE seller-finance-service WalletResponse(sellerId, availableBalance,
// pendingBalance, totalEarned, lastPayoutAt). FE legacy consumers want
// balance/pending — aliased through the transform.
export const walletSchema = z
  .object({
    sellerId: sellerIdSchema.optional(),
    // Legacy FE-facing names
    balance: z.number().optional(),
    pending: z.number().optional(),
    // Live BE names
    availableBalance: z.number().optional(),
    pendingBalance: z.number().optional(),
    totalEarned: z.number().optional(),
    lastPayoutAt: z.string().nullable().optional(),
    currency: z.string().default("VND"),
    updatedAt: z.string().optional(),
  })
  .passthrough()
  .transform((raw) => ({
    sellerId: raw.sellerId,
    balance: raw.balance ?? raw.availableBalance ?? 0,
    pending: raw.pending ?? raw.pendingBalance ?? 0,
    totalEarned: raw.totalEarned,
    lastPayoutAt: raw.lastPayoutAt,
    currency: raw.currency,
    updatedAt: raw.updatedAt,
  }));

// BE seller-finance-service PayoutResponse(payoutId, sellerId, amount, status,
// createdAt). FE legacy consumers want id/requestedAt — aliased through the
// transform. completedAt does not exist on the BE today; consumers fall back
// to status === "COMPLETED" to show a completion state.
export const payoutSchema = z
  .object({
    // Legacy FE-facing names
    id: z.string().optional(),
    requestedAt: z.string().optional(),
    completedAt: z.string().nullable().optional(),
    // Live BE names
    payoutId: z.string().optional(),
    sellerId: sellerIdSchema.optional(),
    createdAt: z.string().optional(),
    amount: z.number(),
    status: z.string(),
    currency: z.string().optional(),
  })
  .passthrough()
  .transform((raw) => ({
    id: raw.id ?? raw.payoutId ?? "",
    sellerId: raw.sellerId,
    amount: raw.amount,
    status: parsePayoutStatus(raw.status),
    requestedAt: raw.requestedAt ?? raw.createdAt,
    completedAt: raw.completedAt,
    currency: raw.currency ?? "VND",
  }));
export type Payout = z.infer<typeof payoutSchema>;
export type Wallet = z.infer<typeof walletSchema>;
