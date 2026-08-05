import { z } from "zod";

import { payoutSchema, walletSchema, type Payout } from "@/shared/contracts/api";
import { api } from "@/shared/api/client";

export type { Payout };

export const myWallet = () => api.get("/sellers/me/finance/wallet", walletSchema);
export const myPayouts = () => api.get("/sellers/me/finance/payouts", z.array(payoutSchema));
export type PayoutRequestBody = { amount: number; currency: string };

export const requestPayout = (body: PayoutRequestBody, idempotencyKey: string) =>
  api.post("/sellers/me/finance/payouts", payoutSchema, body, { idempotencyKey });
