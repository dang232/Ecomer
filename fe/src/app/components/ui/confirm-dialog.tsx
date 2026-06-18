import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { useId, useState } from "react";

import { useEscapeKey } from "../../hooks/use-escape-key";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called with the reason string when reasonField is enabled; undefined otherwise. */
  onConfirm: (reason?: string) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "warning" | "danger";
  icon?: ReactNode;
  /** When true, renders a required textarea. onConfirm receives the trimmed value. */
  reasonField?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "warning",
  icon,
  reasonField = false,
}: ConfirmDialogProps) {
  useEscapeKey(open, onClose);
  const titleId = useId();
  const [reason, setReason] = useState("");

  const iconWrapperClass =
    variant === "danger"
      ? "w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 [&>svg]:w-6 [&>svg]:h-6"
      : "w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4 [&>svg]:w-6 [&>svg]:h-6";

  const confirmClass =
    variant === "danger"
      ? "px-5 py-2.5 rounded-[var(--radius-lg)] text-sm font-medium bg-error text-white hover:opacity-90 transition-opacity"
      : "px-5 py-2.5 rounded-[var(--radius-lg)] text-sm font-medium bg-primary text-white hover:opacity-90 transition-opacity";

  return (
    <AnimatePresence>
      {open ? (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          role="presentation"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="bg-card rounded-[var(--radius-xl)] w-full max-w-[400px] p-8 text-center shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(e) => e.stopPropagation()}
          >
            {icon ? (
              <div className={iconWrapperClass} aria-hidden="true">
                {icon}
              </div>
            ) : null}

            <h3 id={titleId} className="text-lg font-bold text-foreground mb-2">
              {title}
            </h3>

            <p className="text-sm text-text-secondary mb-6">{description}</p>

            {reasonField ? (
              <div className="mb-6">
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Enter reason"
                  required
                  minLength={5}
                  rows={3}
                  className="w-full rounded-[var(--radius-md)] border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  aria-label="Reason"
                />
              </div>
            ) : null}

            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-[var(--radius-lg)] text-sm font-medium border border-border bg-transparent text-foreground hover:bg-background transition-colors"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                disabled={reasonField && reason.trim().length < 5}
                onClick={() => {
                  onConfirm(reason.trim() || undefined);
                  setReason("");
                  onClose();
                }}
                className={`${confirmClass} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
