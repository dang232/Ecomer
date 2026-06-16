/**
 * Brand tokens — single source of truth for colors, gradients, and the brand font.
 *
 * Inline `style={{ background: "var(--primary)" }}` is scattered across the AI-generated UI.
 * Use these constants instead so re-skinning is a one-file change.
 */

export const colors = {
  primary: "var(--primary)",
  primaryDeep: "#009990",
  primaryDark: "#006b65",
  accent: "#FF6200",
  warning: "#F59E0B",
  success: "#10B981",
  danger: "#EF4444",
  flash: "#E53E3E",
  surface: "#f4f6f9",
  border: "#e5e7eb",
  textPrimary: "#1f2937",
  textMuted: "#6b7280",
} as const;

export const gradients = {
  primary: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryDeep})`,
  primaryDeep: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDeep} 50%, ${colors.primaryDark} 100%)`,
  brand: `linear-gradient(to right, ${colors.primary}, ${colors.primaryDeep})`,
  hero: `linear-gradient(135deg, rgba(0,191,179,0.06), rgba(255,98,0,0.04))`,
} as const;

export const fonts = {
  display: "'Be Vietnam Pro', sans-serif",
} as const;

/**
 * Translucent backdrop used by every modal/dialog. Pass to `style={{ background: ... }}`
 * (the dialogs are still inline-styled — Slice 5 will move them into Tailwind tokens).
 */
export const modalBackdropBg = "rgba(0,0,0,0.5)";
