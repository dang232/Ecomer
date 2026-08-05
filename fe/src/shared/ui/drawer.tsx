import { X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

import { IconButton } from "./icon-button";

export interface DrawerProps {
  open: boolean;
  title: string;
  description?: string;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Use a visible Cancel action instead of a duplicate close icon when supplied. */
  showCloseButton?: boolean;
}

const focusableSelector = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function Drawer({
  open,
  title,
  description,
  onOpenChange,
  children,
  footer,
  showCloseButton = true,
}: DrawerProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => {
      const requested = panelRef.current?.querySelector<HTMLElement>("[data-autofocus]");
      const content = panelRef.current?.querySelector<HTMLElement>("[data-drawer-content]");
      const first = content?.querySelector<HTMLElement>(focusableSelector);
      (requested ?? first ?? panelRef.current)?.focus();
    });

    return () => {
      cancelAnimationFrame(frame);
      restoreFocusRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onOpenChange, open]);

  if (!open) return null;

  const trapFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || !panelRef.current) return;
    const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(focusableSelector));
    if (focusable.length === 0) {
      event.preventDefault();
      panelRef.current.focus();
      return;
    }
    const activeIndex = focusable.indexOf(document.activeElement as HTMLElement);
    const currentIndex = activeIndex < 0 ? 0 : activeIndex;
    const targetIndex = event.shiftKey
      ? (currentIndex - 1 + focusable.length) % focusable.length
      : (currentIndex + 1) % focusable.length;
    event.preventDefault();
    focusable[targetIndex]?.focus();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 bg-[var(--color-overlay)]" role="presentation">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={trapFocus}
        className="fixed inset-y-0 right-0 z-50 grid w-full max-w-[min(100vw,36rem)] grid-rows-[auto_minmax(0,1fr)_auto] border-l border-border bg-card text-card-foreground shadow-[var(--shadow-medium)]"
      >
        <header className="border-b border-border px-5 py-4 sm:px-6">
          <h2 id={titleId} className="text-lg font-bold text-foreground">
            {title}
          </h2>
          {description ? (
            <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
        </header>
        <div data-drawer-content className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
          {children}
        </div>
        <footer className="flex min-h-[var(--target-web)] flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4 sm:px-6">
          {showCloseButton ? (
            <IconButton label="Close drawer" onClick={() => onOpenChange(false)}>
              <X />
            </IconButton>
          ) : null}
          {footer ? <div className="flex flex-wrap justify-end gap-3">{footer}</div> : null}
        </footer>
      </div>
    </div>,
    document.body,
  );
}
