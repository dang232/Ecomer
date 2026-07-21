import { useTranslation } from "react-i18next";

import { Dialog } from "../../shared/ui/dialog";

export interface GuestCartMergeDialogProps {
  open: boolean;
  onClose: () => void;
  onMerge: () => void;
  onKeepSeparate: () => void;
  guestItemCount: number;
  serverItemCount: number;
  isMerging?: boolean;
}

/**
 * Modal dialog that appears when a logged-in user has both guest cart items
 * and server cart items, asking them whether to merge or keep separate.
 */
export function GuestCartMergeDialog({
  open,
  onClose,
  onMerge,
  onKeepSeparate,
  guestItemCount,
  serverItemCount,
  isMerging = false,
}: GuestCartMergeDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("cart.merge.title")}
      description={t("cart.merge.description", {
        guestCount: guestItemCount,
        serverCount: serverItemCount,
      })}
      size="sm"
      dismissDisabled={isMerging}
      footer={
        <div className="flex w-full gap-3">
          <button
            onClick={onKeepSeparate}
            disabled={isMerging}
            className="flex-1 px-4 py-2.5 rounded-[var(--radius-md)] border border-border text-sm font-medium text-foreground bg-card hover:bg-surface-elevated transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("cart.merge.keepBtn")}
          </button>
          <button
            onClick={onMerge}
            disabled={isMerging}
            className="flex-1 px-4 py-2.5 rounded-[var(--radius-md)] text-sm font-medium text-white bg-primary hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isMerging ? (
              <>
                <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                <span>...</span>
              </>
            ) : (
              t("cart.merge.mergeBtn")
            )}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Guest cart summary */}
        <div className="flex items-center justify-between p-3 rounded-[var(--radius-md)] bg-surface-elevated">
          <span className="text-sm font-medium text-foreground">
            {t("cart.guestBanner").replace("Log in to save your cart and checkout", "Guest Cart")}
          </span>
          <span className="text-sm font-semibold text-primary">{guestItemCount}</span>
        </div>

        {/* Server cart summary */}
        <div className="flex items-center justify-between p-3 rounded-[var(--radius-md)] bg-surface-elevated">
          <span className="text-sm font-medium text-foreground">Saved Cart</span>
          <span className="text-sm font-semibold text-primary">{serverItemCount}</span>
        </div>
      </div>
    </Dialog>
  );
}
