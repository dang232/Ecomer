import { IconX } from "@tabler/icons-react";
import { motion, AnimatePresence } from "motion/react";
import { type ReactNode, type MouseEvent, useId, useRef, useEffect } from "react";

import { useEscapeKey } from "../../hooks/use-escape-key";
import { modalBackdropBg } from "../../lib/ui/theme";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Disable the escape-key + backdrop click handlers (e.g. while submitting). */
  dismissDisabled?: boolean;
  /**
   * Reference to the element that triggered the modal.
   * When provided, focus will be restored to this element when the modal closes.
   * Falls back to `document.activeElement` at open time.
   */
  triggerRef?: React.RefObject<Element | null>;
  /** Optional title rendered in the modal header; pass `null` to omit the header entirely. */
  title?: ReactNode;
  /** Optional subtitle / metadata under the title. */
  subtitle?: ReactNode;
  /** When true the close icon is hidden (useful when only programmatic dismiss is allowed). */
  hideCloseButton?: boolean;
  /** Width preset; defaults to "md". */
  size?: "sm" | "md" | "lg" | "xl";
  /**
   * When true the modal becomes scrollable: the panel grows up to 90vh, the
   * header sticks to the top, and the body scrolls. Used by long forms like
   * the seller product editor.
   */
  scrollable?: boolean;
  /** Footer content (typically Cancel/Confirm buttons). */
  footer?: ReactNode;
  children?: ReactNode;
  /** Backdrop click handler override; defaults to `onClose`. */
  onBackdropClick?: (e: MouseEvent<HTMLDivElement>) => void;
}

const SIZE_CLASS: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-3xl",
};

/**
 * Single modal/dialog primitive used by every confirmation, form, and detail dialog.
 *
 * Replaces five hand-rolled implementations (TrackingModal, ReturnModal, ShipDialog,
 * CouponDialog, the inline modal in seller-product-modal). Handles backdrop, escape
 * key, click-outside, motion, and the close button so individual dialogs only own
 * their content.
 */
export function Modal({
  open,
  onClose,
  dismissDisabled = false,
  triggerRef: externalTriggerRef,
  title,
  subtitle,
  hideCloseButton = false,
  size = "md",
  scrollable = false,
  footer,
  children,
  onBackdropClick,
}: ModalProps) {
  useEscapeKey(open && !dismissDisabled, onClose);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const fallbackTriggerRef = useRef<Element | null>(null);

  // Save the element that opened the modal so we can return focus on close.
  // When an external ref is provided we track via it; otherwise fall back to internal ref.
  useEffect(() => {
    if (open) {
      if (externalTriggerRef) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- external React ref may be MutableRefObject or RefObject
        (externalTriggerRef as React.MutableRefObject<Element | null>).current = document.activeElement;
      } else {
        fallbackTriggerRef.current = document.activeElement;
      }
      // Move focus into the panel on the next frame after animation starts.
      requestAnimationFrame(() => {
        const first = panelRef.current?.querySelector<HTMLElement>(
          "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
        );
        first?.focus();
      });
    } else {
      const ref = externalTriggerRef ?? fallbackTriggerRef;
      (ref.current as HTMLElement | null)?.focus();
    }
  }, [open]);

  // Focus trap: keep Tab/Shift+Tab cycling within the panel.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !panelRef.current) return;
    const focusable = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(
        "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
      ),
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const handleBackdrop = (e: MouseEvent<HTMLDivElement>) => {
    if (dismissDisabled) return;
    if (onBackdropClick) onBackdropClick(e);
    else onClose();
  };

  const panelClass = scrollable
    ? `bg-card rounded-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto ${SIZE_CLASS[size]}`
    : `bg-card rounded-2xl w-full shadow-2xl ${SIZE_CLASS[size]}`;
  const headerClass = scrollable
    ? "sticky top-0 z-10 bg-card flex items-start justify-between gap-3 px-6 py-4 border-b border-border"
    : "flex items-start justify-between gap-3 px-6 py-4 border-b border-border";

  return (
    <AnimatePresence>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: modalBackdropBg }}
          onClick={handleBackdrop}
          role="presentation"
        >
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className={panelClass}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
          >
            {title || !hideCloseButton ? (
              <div className={headerClass}>
                <div className="flex-1 min-w-0">
                  {title ? <h3 id={titleId} className="text-lg font-bold text-foreground">{title}</h3> : null}
                  {subtitle ? <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div> : null}
                </div>
                {!hideCloseButton ? (
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={dismissDisabled}
                    className="w-8 h-8 rounded-full bg-muted hover:bg-gray-200 flex items-center justify-center disabled:opacity-50 shrink-0"
                    aria-label="Đóng"
                  >
                    <IconX size={16} />
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="p-6">{children}</div>

            {footer ? (
              <div className="px-6 py-4 border-t border-border flex gap-3">{footer}</div>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
