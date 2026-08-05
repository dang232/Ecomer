/**
 * Domain constants surfaced to the UI. Keeping them here means a price-rule change
 * does not require editing every page that references "30,000 VND" or
 * "free shipping above 500,000 VND".
 *
 * The eventual home for these is the server (`/checkout/calculate`); they live in
 * the FE only as a fallback while that endpoint is unavailable.
 */

/** Subtotal at or above which shipping is free in the local preview. */
export const FREE_SHIPPING_THRESHOLD = 500_000;

/** Flat-rate shipping fee used when no shipping options have been quoted yet. */
export const FLAT_SHIPPING_FEE = 30_000;

/** Tracking timeline shown when the carrier integration is unavailable. */
export const TRACKING_STEPS_FALLBACK: readonly string[] = [
  "Đặt hàng thành công",
  "Người bán xác nhận đơn",
  "Đã lấy hàng",
  "Đang trên đường giao",
  "Giao thành công",
];
