import { IconAlertCircle, IconArrowLeft, IconCamera, IconCheck } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

import { ApiError } from "../lib/api";
import { requestReturn, type ReturnReason } from "../lib/api/endpoints/returns";

const REASON_OPTIONS: ReturnReason[] = [
  "damaged",
  "wrong_item",
  "changed_mind",
  "not_as_described",
  "other",
];

const PICKUP_TYPE_OPTIONS = [
  { value: "pickup", labelKey: "return.request.pickup" },
  { value: "dropoff", labelKey: "return.request.dropoff" },
] as const;

interface ReturnRequestPageProps {
  /** Pre-selected sub-order ID from query param */
  initialSubOrderId?: string;
}

export function ReturnRequestPage({ initialSubOrderId }: ReturnRequestPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const preSelectedSubOrderId = initialSubOrderId || searchParams.get("subOrderId") || "";
  const [subOrderId, setSubOrderId] = useState(preSelectedSubOrderId);
  const [reason, setReason] = useState<ReturnReason | "">("");
  const [reasonDetail, setReasonDetail] = useState("");
  const [pickupType, setPickupType] = useState<"pickup" | "dropoff">("pickup");
  const [photos, setPhotos] = useState<string[]>([]);

  const submitReturn = useMutation({
    mutationFn: () =>
      requestReturn({
        subOrderId,
        reason: reasonDetail || reason,
        pickupType,
        evidencePhotos: photos.length > 0 ? photos : undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["returns"] });
      toast.success(t("return.request.success"));
      void navigate("/returns");
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : t("return.request.error");
      toast.error(message);
    },
  });

  const handleSubmit = useCallback(() => {
    if (!subOrderId) {
      toast.error(t("return.request.selectOrder"));
      return;
    }
    if (!reason) {
      toast.error(t("return.request.selectReason"));
      return;
    }
    if (reasonDetail.trim().length > 0 && reasonDetail.trim().length < 10) {
      toast.error(t("return.request.reasonTooShort"));
      return;
    }
    submitReturn.mutate();
  }, [subOrderId, reason, reasonDetail, submitReturn, t]);

  const handlePhotoUpload = useCallback(() => {
    // In a real implementation, this would trigger a file picker
    // and upload the photo, then add the URL to the photos array.
    // For now, we'll just show a placeholder toast.
    toast.info(t("return.request.photoUploadHint"));
  }, [t]);

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/orders"
          className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
          aria-label={t("return.request.backToOrders")}
        >
          <IconArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-foreground">{t("return.request.title")}</h1>
      </div>

      <div className="bg-card border border-border rounded-[var(--radius-lg)] p-6 space-y-6">
        {/* Sub-Order ID Input */}
        <div>
          <label htmlFor="subOrderId" className="block text-sm font-semibold text-foreground mb-2">
            {t("return.request.orderIdLabel")} <span className="text-red-500">*</span>
          </label>
          <input
            id="subOrderId"
            type="text"
            value={subOrderId}
            onChange={(e) => setSubOrderId(e.target.value)}
            placeholder={t("return.request.orderIdPlaceholder")}
            className="w-full px-4 py-2.5 border border-border rounded-xl text-sm outline-none focus:border-[var(--primary)] bg-background"
          />
          <p className="mt-1 text-xs text-muted-foreground">{t("return.request.orderIdHint")}</p>
        </div>

        {/* Reason Dropdown */}
        <div>
          <label htmlFor="reason" className="block text-sm font-semibold text-foreground mb-2">
            {t("return.request.reasonLabel")} <span className="text-red-500">*</span>
          </label>
          <select
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value as ReturnReason)}
            className="w-full px-4 py-2.5 border border-border rounded-xl text-sm outline-none focus:border-[var(--primary)] bg-background"
          >
            <option value="">{t("return.request.selectReasonOption")}</option>
            {REASON_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {t(`return.reason.${r}`)}
              </option>
            ))}
          </select>
        </div>

        {/* Reason Detail */}
        <div>
          <label
            htmlFor="reasonDetail"
            className="block text-sm font-semibold text-foreground mb-2"
          >
            {t("return.request.reasonDetailLabel")}
          </label>
          <textarea
            id="reasonDetail"
            value={reasonDetail}
            onChange={(e) => setReasonDetail(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder={t("return.request.reasonDetailPlaceholder")}
            className="w-full px-4 py-2.5 border border-border rounded-xl text-sm outline-none focus:border-[var(--primary)] resize-none bg-background"
            aria-describedby="reasonDetail-counter"
          />
          <p
            id="reasonDetail-counter"
            aria-live="polite"
            className="mt-1 text-xs text-muted-foreground text-right"
          >
            {reasonDetail.length}/500
          </p>
        </div>

        {/* Pickup Type */}
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">
            {t("return.request.pickupTypeLabel")}
          </label>
          <div className="flex gap-4">
            {PICKUP_TYPE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                  pickupType === option.value
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-border-hover"
                }`}
              >
                <input
                  type="radio"
                  name="pickupType"
                  value={option.value}
                  checked={pickupType === option.value}
                  onChange={(e) => setPickupType(e.target.value as "pickup" | "dropoff")}
                  className="sr-only"
                />
                {pickupType === option.value ? <IconCheck size={16} /> : null}
                <span className="text-sm font-medium">{t(option.labelKey)}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Photo Upload */}
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">
            {t("return.request.photoLabel")}
          </label>
          <div className="flex flex-wrap gap-3">
            {photos.map((photo, index) => (
              <div
                key={index}
                className="relative w-20 h-20 rounded-lg border border-border overflow-hidden"
              >
                <img
                  src={photo}
                  alt={`Evidence ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => setPhotos((p) => p.filter((_, i) => i !== index))}
                  className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white hover:bg-black/70"
                  aria-label={t("return.request.removePhoto")}
                >
                  <IconAlertCircle size={14} />
                </button>
              </div>
            ))}
            <button
              onClick={handlePhotoUpload}
              className="w-20 h-20 flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border hover:border-primary transition-colors"
            >
              <IconCamera size={20} className="text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">
                {t("return.request.addPhoto")}
              </span>
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t("return.request.photoHint")}</p>
        </div>

        {/* Info Box */}
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 flex items-start gap-3">
          <IconAlertCircle size={18} className="shrink-0 mt-0.5" />
          <p>{t("return.request.footnote")}</p>
        </div>

        {/* Submit Button */}
        <div className="flex gap-3 pt-2">
          <Link
            to="/orders"
            className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors text-center"
          >
            {t("common.cancel")}
          </Link>
          <button
            onClick={handleSubmit}
            disabled={submitReturn.isPending}
            className="flex-1 py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-all"
            style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-deep))" }}
          >
            {submitReturn.isPending ? t("return.request.submitting") : t("return.request.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ReturnRequestPageWrapper() {
  return <ReturnRequestPage />;
}

export default ReturnRequestPageWrapper;
