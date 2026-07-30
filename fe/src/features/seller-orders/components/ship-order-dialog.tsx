import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Modal } from "@/shared/ui";

interface ShipOrderDialogProps {
  subOrderId: string;
  open: boolean;
  onClose: () => void;
  onSubmit: (input: { carrier: string; trackingNumber: string }) => void;
  isSubmitting: boolean;
}

export function ShipOrderDialog({
  subOrderId,
  open,
  onClose,
  onSubmit,
  isSubmitting,
}: ShipOrderDialogProps) {
  const { t } = useTranslation();
  const [carrier, setCarrier] = useState("GHN");
  const [trackingNumber, setTrackingNumber] = useState("");

  const otherLabel = t("seller.orders.shipDialog.carrierOther");
  const carriers = ["GHN", "GHTK", "VNPost", "J&T", otherLabel];

  const handleSubmit = () => {
    if (!carrier.trim() || carrier === otherLabel) {
      toast.error(t("seller.orders.shipDialog.missingCarrier"));
      return;
    }
    if (!trackingNumber.trim()) {
      toast.error(t("seller.orders.shipDialog.missingTracking"));
      return;
    }
    onSubmit({ carrier: carrier.trim(), trackingNumber: trackingNumber.trim() });
  };

  if (!open) return null;

  return (
    <Modal
      open
      onClose={onClose}
      dismissDisabled={isSubmitting}
      title={t("seller.orders.shipDialog.title")}
      subtitle={
        <span className="font-mono">
          {t("seller.orders.shipDialog.subOrderLabel", { id: subOrderId })}
        </span>
      }
      footer={
        <>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground disabled:opacity-50"
          >
            {t("seller.orders.shipDialog.cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
            style={{ background: "oklch(52% 0.2 270)" }}
          >
            {isSubmitting ? t("seller.orders.shipDialog.submitting") : t("seller.orders.shipDialog.submit")}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <span className="block text-sm font-semibold text-foreground mb-2">
            {t("seller.orders.shipDialog.carrierLabel")}
          </span>
          <div className="flex flex-wrap gap-2">
            {carriers.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCarrier(c)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors"
                style={
                  carrier === c
                    ? {
                        background: "var(--primary)",
                        color: "white",
                        borderColor: "var(--primary)",
                      }
                    : {
                        background: "white",
                        color: "var(--muted-foreground)",
                        borderColor: "var(--border)",
                      }
                }
              >
                {c}
              </button>
            ))}
          </div>
          {carrier === otherLabel ? (
            <input
              value={""}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder={t("seller.orders.shipDialog.carrierOtherPlaceholder")}
              className="mt-2 w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-[var(--primary)]"
            />
          ) : null}
        </div>

        <div>
          <label
            htmlFor="seller-tracking-number"
            className="block text-sm font-semibold text-foreground mb-1.5"
          >
            {t("seller.orders.shipDialog.trackingNumberLabel")}
          </label>
          <input
            id="seller-tracking-number"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder={t("seller.orders.shipDialog.trackingNumberPlaceholder")}
            className="w-full px-3 py-2.5 border border-border rounded-xl text-sm outline-none focus:border-[var(--primary)]"
          />
        </div>
      </div>
    </Modal>
  );
}
