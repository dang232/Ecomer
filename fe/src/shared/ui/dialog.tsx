import { X } from "lucide-react";
import { type MouseEvent, type ReactNode, type RefObject, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

import { cn } from "../lib/cn";

import { IconButton } from "./icon-button";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  dismissDisabled?: boolean;
  hideCloseButton?: boolean;
  scrollable?: boolean;
  closeLabel?: string;
  triggerRef?: RefObject<Element | null>;
  onBackdropClick?: (event: MouseEvent<HTMLDivElement>) => void;
}

const sizeClasses: Record<NonNullable<DialogProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-3xl",
};

const focusableSelector = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  dismissDisabled = false,
  hideCloseButton = false,
  scrollable = false,
  closeLabel = "Close dialog",
  triggerRef,
  onBackdropClick,
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current =
      triggerRef?.current instanceof HTMLElement
        ? triggerRef.current
        : document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;

    const frame = requestAnimationFrame(() => {
      const requested = panelRef.current?.querySelector<HTMLElement>("[data-autofocus]");
      const first = panelRef.current?.querySelector<HTMLElement>(focusableSelector);
      (requested ?? first ?? panelRef.current)?.focus();
    });

    return () => {
      cancelAnimationFrame(frame);
      restoreFocusRef.current?.focus();
    };
  }, [open, triggerRef]);

  useEffect(() => {
    if (!open || dismissDisabled) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [dismissDisabled, onClose, open]);

  if (!open) return null;

  const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || !panelRef.current) return;
    const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(focusableSelector));
    if (focusable.length === 0) {
      event.preventDefault();
      panelRef.current.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || dismissDisabled) return;
    if (onBackdropClick) onBackdropClick(event);
    else onClose();
  };

  return createPortal(
    <div
      data-testid="dialog-backdrop"
      data-slot="dialog-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] p-4"
      onMouseDown={handleBackdrop}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={handlePanelKeyDown}
        className={cn(
          "flex w-full flex-col overflow-hidden rounded-[var(--radius-overlay)] border border-border bg-card text-card-foreground shadow-[var(--shadow-medium)]",
          sizeClasses[size],
          scrollable && "max-h-[min(90vh,48rem)]",
        )}
      >
        {title || description || !hideCloseButton ? (
          <header className="flex shrink-0 items-start gap-4 border-b border-border px-5 py-4 sm:px-6">
            <div className="min-w-0 flex-1">
              {title ? (
                <h2 id={titleId} className="text-lg font-bold text-foreground">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <div id={descriptionId} className="mt-1 text-sm text-muted-foreground">
                  {description}
                </div>
              ) : null}
            </div>
            {!hideCloseButton ? (
              <IconButton
                label={closeLabel}
                onClick={onClose}
                disabled={dismissDisabled}
                className="-mr-2 -mt-2"
              >
                <X />
              </IconButton>
            ) : null}
          </header>
        ) : null}

        <div className={cn("px-5 py-5 sm:px-6", scrollable && "min-h-0 overflow-y-auto")}>
          {children}
        </div>

        {footer ? (
          <footer className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-border px-5 py-4 sm:px-6">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
