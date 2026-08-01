import { z } from "zod";

import { api } from "@/shared/api/client";

/**
 * Maps the order-service ReturnResponse wire contract to the existing return
 * UI aliases while retaining the backend field names for new callers.
 */
export const returnResponseSchema = z
  .object({
    returnId: z.string(),
    orderId: z.string(),
    subOrderId: z.number().int(),
    buyerId: z.string(),
    reason: z.string(),
    status: z.enum(["REQUESTED", "APPROVED", "REJECTED", "COMPLETED"]),
    requestedAt: z.string(),
    resolvedAt: z.string().nullable(),
  })
  .transform((response) => ({
    ...response,
    id: response.returnId,
    createdAt: response.requestedAt,
    // Not emitted by the current backend DTO, but retained for existing UI
    // consumers that render it when a future response supplies one.
    refundAmount: undefined as number | undefined,
  }));
export type Return = z.infer<typeof returnResponseSchema>;

/** The DisputeResponse returned by POST /returns/{returnId}/disputes. */
export const disputeResponseSchema = z.object({
  disputeId: z.string(),
  returnId: z.string(),
  buyerReason: z.string(),
  sellerResponse: z.string().nullable(),
  adminResolution: z.string().nullable(),
  resolvedBy: z.string().nullable(),
  status: z.string(),
});
export type Dispute = z.infer<typeof disputeResponseSchema>;

/**
 * Reason options for return requests
 */
export const RETURN_REASON_VALUES = [
  "damaged",
  "wrong_item",
  "changed_mind",
  "not_as_described",
  "other",
] as const;
export type ReturnReason = (typeof RETURN_REASON_VALUES)[number];

/**
 * Return status values from backend
 */
export const RETURN_STATUS_VALUES = [
  "REQUESTED",
  "APPROVED",
  "REJECTED",
  "COMPLETED",
  "DISPUTED",
] as const;
export type ReturnStatus = (typeof RETURN_STATUS_VALUES)[number];

/**
 * Request a return for a sub-order
 */
export const requestReturn = (body: {
  subOrderId: string;
  reason: string;
  pickupType?: "pickup" | "dropoff";
  evidencePhotos?: string[];
}) => api.post("/returns", returnResponseSchema, body);

/**
 * List returns for the current buyer
 */
export const listReturns = () => api.get("/returns", z.array(returnResponseSchema));

/**
 * List returns for sellers (pending approvals)
 * Note: Backend may need to implement /seller/returns endpoint
 */
export const listSellerReturns = () => api.get("/seller/returns", z.array(returnResponseSchema));

/**
 * Get a single return by ID
 */
export const getReturn = (returnId: string) =>
  api.get(`/returns/${encodeURIComponent(returnId)}`, returnResponseSchema);

/**
 * Seller: Approve a return request
 */
export const approveReturn = (returnId: string) =>
  api.post(`/returns/${encodeURIComponent(returnId)}/approve`, returnResponseSchema);

/**
 * Seller: Reject a return request. The backend accepts no request body.
 */
export const rejectReturn = (returnId: string) =>
  api.post(`/returns/${encodeURIComponent(returnId)}/reject`, returnResponseSchema);

/**
 * Seller: Mark return as completed
 */
export const completeReturn = (returnId: string) =>
  api.post(`/returns/${encodeURIComponent(returnId)}/complete`, returnResponseSchema);

/**
 * Buyer: Open a dispute for a return
 */
export const openDispute = (returnId: string, body: { buyerReason: string }) =>
  api.post(`/returns/${encodeURIComponent(returnId)}/disputes`, disputeResponseSchema, body);
