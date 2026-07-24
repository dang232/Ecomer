/**
 * Domain enums for status / payment / notification kinds.
 *
 * These are the canonical TypeScript types — Zod schemas at the API boundary
 * stay as `z.string()` to absorb backend churn, but consumers always run the
 * raw value through one of the `parse*` helpers so UI logic operates on the
 * narrow union, never on free-form strings.
 *
 * Replaces fragile `value.includes("CANCEL")` style detection scattered across
 * pages.
 */

// ─── Order status ────────────────────────────────────────────────────────────

/** UI-facing order status. Multiple backend strings collapse to one of these. */
export type OrderStatusUi =
  "pending" | "confirmed" | "shipping" | "delivered" | "cancelled" | "returned";

/**
 * Map any backend order status string to one of the known UI values. Unknown
 * values fall back to "pending" so the UI never crashes on a new state.
 */
export function parseOrderStatus(raw: string | null | undefined): OrderStatusUi {
  const v = (raw ?? "").toUpperCase();
  if (v.includes("CANCEL") || v.includes("REJECT")) return "cancelled";
  if (v.includes("RETURN") || v.includes("REFUND")) return "returned";
  if (v.includes("PENDING")) return "pending";
  if (v.includes("DELIVER") || v === "COMPLETED") return "delivered";
  if (v.includes("SHIP")) return "shipping";
  if (
    v.includes("ACCEPT") ||
    v.includes("CONFIRM") ||
    v.includes("PACK") ||
    v.includes("PROCESS")
  ) {
    return "confirmed";
  }
  return "pending";
}

// ─── Return / refund status ─────────────────────────────────────────────────

export type ReturnStatusUi = "pending" | "approved" | "rejected" | "completed" | "escalated";

export function parseReturnStatus(raw: string | null | undefined): ReturnStatusUi {
  const v = (raw ?? "").toUpperCase();
  if (v.includes("APPROV")) return "approved";
  if (v.includes("REJECT")) return "rejected";
  if (v.includes("COMPLETE") || v.includes("REFUND")) return "completed";
  if (v.includes("ESCALAT") || v.includes("DISPUTE")) return "escalated";
  return "pending";
}

// ─── Payout status ──────────────────────────────────────────────────────────

export type PayoutStatusUi = "pending" | "completed" | "failed";

export function parsePayoutStatus(raw: string | null | undefined): PayoutStatusUi {
  const v = (raw ?? "").toUpperCase();
  if (v.includes("COMPLETE") || v.includes("PAID")) return "completed";
  if (v.includes("FAIL") || v.includes("REJECT")) return "failed";
  return "pending";
}

// ─── Payment method ─────────────────────────────────────────────────────────

/** Supported checkout payment methods. The backend echoes one of these strings. */
export const PAYMENT_METHODS = [
  "COD",
  "VNPAY",
  "MOMO",
  "BANK",
  "VIETQR",
  "STRIPE",
  "PAYPAL",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function isPaymentMethod(value: string | null | undefined): value is PaymentMethod {
  return !!value && (PAYMENT_METHODS as readonly string[]).includes(value);
}

// ─── Coupon type ────────────────────────────────────────────────────────────

export const COUPON_TYPES = ["PERCENT", "FIXED"] as const;
export type CouponType = (typeof COUPON_TYPES)[number];

// ─── Notification kind ──────────────────────────────────────────────────────
//
// The notification stream is heterogeneous — known kinds get typed handling
// (icon, deep-link template), unknown kinds render as "generic".

export const KNOWN_NOTIFICATION_KINDS = [
  "ORDER_PLACED",
  "ORDER_ACCEPTED",
  "ORDER_SHIPPED",
  "ORDER_DELIVERED",
  "ORDER_CANCELLED",
  "PAYMENT_COMPLETED",
  "PAYMENT_FAILED",
  "RETURN_REQUESTED",
  "RETURN_APPROVED",
  "RETURN_REJECTED",
  "REVIEW_APPROVED",
  "PAYOUT_COMPLETED",
  "SELLER_APPROVED",
] as const;
export type NotificationKind = (typeof KNOWN_NOTIFICATION_KINDS)[number] | "GENERIC";

export function parseNotificationKind(raw: string | null | undefined): NotificationKind {
  if (!raw) return "GENERIC";
  return (KNOWN_NOTIFICATION_KINDS as readonly string[]).includes(raw)
    ? (raw as NotificationKind)
    : "GENERIC";
}
