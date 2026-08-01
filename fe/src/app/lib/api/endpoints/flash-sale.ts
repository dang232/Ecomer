import { z } from "zod";

import {
  activeFlashSaleCampaignSchema,
  flashSaleStockResponseSchema,
  reserveFlashSaleResponseSchema,
  type ActiveFlashSaleCampaign,
  type FlashSaleReservation,
} from "../../../types/api";
import { api } from "../client";

/**
 * Inventory-service flash-sale endpoints (FE-PLAN §2 inventory-service / 8083).
 * The `/reserve` call is what the buyer flow needs during a flash-sale checkout;
 * `/stock` and `/release` are present for completeness and admin tooling.
 */

export type { ActiveFlashSaleCampaign, FlashSaleReservation };

// buyerId is derived from the JWT server-side (pt22 audit fix).
// Sending it on the wire was an impersonation channel — the BE used to write
// whatever `buyerId` you supplied as the reservation owner.
export const reserveFlashSale = (body: { productId: string; quantity: number }) =>
  api.post("/flash-sale/reserve", reserveFlashSaleResponseSchema, body);

export const flashSaleStock = (productId: string) =>
  api.get(
    `/flash-sale/stock/${encodeURIComponent(productId)}`,
    flashSaleStockResponseSchema,
    undefined,
    { auth: false },
  );

export const releaseFlashSale = (reservationId: string) =>
  api.post(`/flash-sale/release/${encodeURIComponent(reservationId)}`, z.null());

/**
 * Active flash-sale campaigns surfaced by inventory-service. Public endpoint —
 * the home page renders these without authentication. `stockRemaining` may be
 * absent or null when the Redis-backed counter isn't live yet, in which case
 * callers can fall back to per-item {@link flashSaleStock} polling.
 */
export const listActiveFlashSaleCampaigns = () =>
  api.get("/flash-sale/active", z.array(activeFlashSaleCampaignSchema), undefined, {
    auth: false,
  });
