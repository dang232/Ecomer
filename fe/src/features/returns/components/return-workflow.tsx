import { AlertCircle, Check, Package } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { Order } from "@/shared/contracts/api";

type PickupType = "pickup" | "dropoff";

interface ReturnWorkflowSubmit {
  subOrderId: string;
  selectedItemId?: string;
  reason: string;
  pickupType: PickupType;
}

interface ReturnWorkflowProps {
  order?: Order | null;
  initialSubOrderId?: string;
  pending?: boolean;
  onSubmit: (input: ReturnWorkflowSubmit) => void;
}

const PICKUP_TYPE_OPTIONS: ReadonlyArray<{ value: PickupType; labelKey: string }> = [
  { value: "pickup", labelKey: "return.request.pickup" },
  { value: "dropoff", labelKey: "return.request.dropoff" },
];

export function ReturnWorkflow({
  order,
  initialSubOrderId,
  pending = false,
  onSubmit,
}: ReturnWorkflowProps) {
  const { t } = useTranslation();
  const availableSubOrders = order?.subOrders ?? [];
  const [subOrderId, setSubOrderId] = useState(initialSubOrderId ?? availableSubOrders[0]?.id ?? "");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [reason, setReason] = useState("");
  const [pickupType, setPickupType] = useState<PickupType>("pickup");
  const [errors, setErrors] = useState<{ subOrderId?: string; item?: string; reason?: string }>({});

  const selectedSubOrder = useMemo(
    () => availableSubOrders.find((subOrder) => subOrder.id === subOrderId) ?? null,
    [availableSubOrders, subOrderId],
  );
  const selectedItems = selectedSubOrder?.items ?? [];

  const handleSubmit = () => {
    const nextErrors: { subOrderId?: string; item?: string; reason?: string } = {};
    if (!subOrderId.trim()) nextErrors.subOrderId = t("return.request.selectOrder");
    if (selectedItems.length > 0 && !selectedItemId.trim()) {
      nextErrors.item = t("return.request.selectItem");
    }
    if (reason.trim().length < 10) nextErrors.reason = t("return.request.reasonTooShort");
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    onSubmit({
      subOrderId,
      selectedItemId: selectedItemId || undefined,
      reason: reason.trim(),
      pickupType,
    });
  };

  return (
    <div className="space-y-6 rounded-[var(--radius-lg)] border border-border bg-card p-6">
      <div>
        <label htmlFor="subOrderId" className="block text-sm font-semibold text-foreground">
          {t("return.request.orderIdLabel", { defaultValue: "Package" })}
        </label>
        {availableSubOrders.length > 0 ? (
          <select
            id="subOrderId"
            value={subOrderId}
            onChange={(event) => {
              setSubOrderId(event.target.value);
              setSelectedItemId("");
            }}
            className="mt-2 w-full rounded-[var(--radius-md)] border border-border bg-background px-4 py-3 text-sm"
          >
            {availableSubOrders.map((subOrder) => (
              <option key={subOrder.id} value={subOrder.id}>
                {subOrder.sellerId ?? subOrder.id}
              </option>
            ))}
          </select>
        ) : (
          <input
            id="subOrderId"
            type="text"
            value={subOrderId}
            onChange={(event) => setSubOrderId(event.target.value)}
            placeholder={t("return.request.orderIdPlaceholder", {
              defaultValue: "Enter the sub-order id",
            })}
            className="mt-2 w-full rounded-[var(--radius-md)] border border-border bg-background px-4 py-3 text-sm"
          />
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {t("return.request.orderIdHint", {
            defaultValue: "Use the package or sub-order id for the items you want to return.",
          })}
        </p>
        {errors.subOrderId ? <p className="mt-2 text-sm text-error">{errors.subOrderId}</p> : null}
      </div>

      {selectedItems.length > 0 ? (
        <div>
          <p className="text-sm font-semibold text-foreground">
            {t("return.request.itemLabel", { defaultValue: "Affected item" })}
          </p>
          <div className="mt-3 space-y-2">
            {selectedItems.map((item) => {
              const choice = `${item.productId}:${item.variantId ?? ""}`;
              const active = choice === selectedItemId;
              return (
                <button
                  key={choice}
                  type="button"
                  onClick={() => setSelectedItemId(choice)}
                  className={`flex w-full items-center justify-between rounded-[var(--radius-md)] border px-4 py-3 text-left transition-colors ${
                    active ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{item.name ?? item.productId}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("orders.itemQuantity", { count: item.quantity })}
                    </p>
                  </div>
                  {active ? <Check size={16} className="shrink-0 text-primary" /> : <Package size={16} className="shrink-0 text-muted-foreground" />}
                </button>
              );
            })}
          </div>
          {errors.item ? <p className="mt-2 text-sm text-error">{errors.item}</p> : null}
        </div>
      ) : null}

      <div>
        <label htmlFor="reason" className="block text-sm font-semibold text-foreground">
          {t("return.request.reasonLabel", { defaultValue: "Return reason" })}
        </label>
        <textarea
          id="reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={4}
          maxLength={500}
          placeholder={t("return.request.reasonDetailPlaceholder", {
            defaultValue: "Describe what went wrong so the seller can resolve it quickly.",
          })}
          className="mt-2 w-full rounded-[var(--radius-md)] border border-border bg-background px-4 py-3 text-sm"
        />
        <p className="mt-1 text-xs text-muted-foreground text-right">{reason.length}/500</p>
        {errors.reason ? <p className="mt-2 text-sm text-error">{errors.reason}</p> : null}
      </div>

      <div>
        <p className="text-sm font-semibold text-foreground">
          {t("return.request.pickupTypeLabel", { defaultValue: "Return method" })}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {PICKUP_TYPE_OPTIONS.map((option) => {
            const active = pickupType === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setPickupType(option.value)}
                className={`flex items-center justify-center gap-2 rounded-[var(--radius-md)] border px-4 py-3 text-sm font-medium transition-colors ${
                  active ? "border-primary bg-primary/5 text-primary" : "border-border text-foreground hover:bg-muted"
                }`}
              >
                {active ? <Check size={16} /> : null}
                {t(option.labelKey, {
                  defaultValue: option.value === "pickup" ? "Carrier pickup" : "Drop off",
                })}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <div className="flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <p>
            {t("return.request.footnote", {
              defaultValue:
                "After you submit, the seller can approve or reject the request. If they do not respond, you can escalate from the return status flow.",
            })}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={pending}
        className="w-full rounded-[var(--radius-md)] bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending
          ? t("return.request.submitting", { defaultValue: "Submitting..." })
          : t("return.request.submit", { defaultValue: "Submit request" })}
      </button>
    </div>
  );
}
