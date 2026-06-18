import type { ReactNode } from "react";

/**
 * Shared status-pill rendering. Inline status pills used to live in four
 * places (SellerOrders, SellerWallet, PayoutsQueue, SellersApproval) with
 * inline color logic — one of pt32's gotcha categories was "drift across
 * pages because each one re-implements the same pill differently."
 *
 * The component normalises the status string and looks up a tone:
 *   - success → green (COMPLETED, APPROVED, SHIPPED, DELIVERED)
 *   - warning → amber (PENDING, PACKED, IN_PROGRESS)
 *   - danger  → red   (FAILED, REJECTED, CANCELLED, REFUNDED)
 *   - info    → teal  (ACCEPTED, OPEN, NEW, ACTIVE)
 *   - neutral → gray  (anything unrecognised)
 *
 * Callers can override with `tone="..."` when the status string isn't in
 * the table (eg seller commission tier "STANDARD" / "PREMIUM").
 */
export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE_PALETTE: Record<StatusTone, { bg: string; fg: string }> = {
  success: { bg: "var(--success-light)", fg: "var(--success)" },
  warning: { bg: "var(--warning-light)", fg: "var(--warning)" },
  danger: { bg: "var(--error-light)", fg: "var(--error)" },
  info: { bg: "var(--info-light)", fg: "var(--info)" },
  neutral: { bg: "var(--muted)", fg: "var(--muted-foreground)" },
};

function inferTone(status: string): StatusTone {
  const s = status.toUpperCase();
  if (
    s.includes("COMPLETED") ||
    s.includes("APPROVED") ||
    s.includes("SHIPPED") ||
    s.includes("DELIVERED") ||
    s.includes("PAID")
  ) {
    return "success";
  }
  if (
    s.includes("FAIL") ||
    s.includes("REJECT") ||
    s.includes("CANCEL") ||
    s.includes("REFUND")
  ) {
    return "danger";
  }
  if (s.includes("PENDING") || s.includes("PACK") || s.includes("IN_PROGRESS")) {
    return "warning";
  }
  if (s.includes("ACCEPT") || s.includes("OPEN") || s.includes("NEW") || s.includes("ACTIVE")) {
    return "info";
  }
  return "neutral";
}

export function StatusPill({
  status,
  tone,
  icon,
  size = "sm",
}: {
  status: string;
  tone?: StatusTone;
  icon?: ReactNode;
  size?: "xs" | "sm";
}) {
  const resolved = TONE_PALETTE[tone ?? inferTone(status)];
  const sizeClass =
    size === "xs"
      ? "px-2 py-0.5 text-[10px]"
      : "px-2.5 py-1 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${sizeClass}`}
      style={{ background: resolved.bg, color: resolved.fg }}
    >
      {icon}
      {status}
    </span>
  );
}
