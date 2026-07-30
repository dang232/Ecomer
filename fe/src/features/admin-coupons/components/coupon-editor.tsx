import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { z } from "zod";

import { ApiError } from "@/shared/api";
import { adminCreateCoupon } from "@/shared/api/endpoints/admin";
import { Modal } from "@/shared/ui/modal";

import { couponFormSchema, COUPON_FORM_TYPES } from "../model/coupon-form";
import type { CouponWriteBody } from "../model/coupon-form";

interface CouponEditorProps {
  open: boolean;
  onClose: () => void;
  /** If provided, edit existing coupon — currently read-only (perUserLimit omission constraint) */
  initialValues?: Partial<z.infer<typeof couponFormSchema>>;
}

export function CouponEditor({ open, onClose, initialValues }: CouponEditorProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [code, setCode] = useState(initialValues?.code ?? "");
  const [type, setType] = useState<"PERCENT" | "FIXED" | "FREE_SHIPPING">(
    initialValues?.type ?? "PERCENT",
  );
  const [value, setValue] = useState(String(initialValues?.value ?? ""));
  const [minOrderValue, setMinOrderValue] = useState(
    initialValues?.minOrderValue != null ? String(initialValues.minOrderValue) : "",
  );
  const [maxDiscount, setMaxDiscount] = useState(
    initialValues?.maxDiscount != null ? String(initialValues.maxDiscount) : "",
  );
  const [maxUses, setMaxUses] = useState(
    initialValues?.maxUses != null ? String(initialValues.maxUses) : "1000",
  );
  const [perUserLimit, setPerUserLimit] = useState(
    initialValues?.perUserLimit != null ? String(initialValues.perUserLimit) : "",
  );
  const [validUntil, setValidUntil] = useState(
    initialValues?.validUntil ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const create = useMutation({
    mutationFn: (body: CouponWriteBody) => adminCreateCoupon(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "coupons"] });
      toast.success(t("admin.coupons.createOk"));
      onClose();
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("admin.coupons.createErr")),
  });

  const handleSubmit = () => {
    setFieldErrors({});
    const parsed = couponFormSchema.safeParse({
      code,
      type,
      value: Number(value) || 0,
      minOrderValue: minOrderValue ? Number(minOrderValue) : undefined,
      maxDiscount: maxDiscount ? Number(maxDiscount) : undefined,
      maxUses: Number(maxUses) || 1000,
      perUserLimit: perUserLimit ? Number(perUserLimit) : undefined,
      validUntil: new Date(validUntil).toISOString(),
    });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        if (!errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    create.mutate(parsed.data);
  };

  if (!open) return null;

  return (
    <Modal
      open
      onClose={onClose}
      dismissDisabled={create.isPending}
      title={t("admin.coupons.dialog.title") ?? "Create new coupon"}
      footer={
        <>
          <button
            onClick={onClose}
            disabled={create.isPending}
            className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-muted-foreground disabled:opacity-50"
          >
            {t("admin.coupons.dialog.cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={create.isPending}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--admin-primary)" }}
          >
            {create.isPending
              ? (t("admin.coupons.dialog.submitting") ?? "Creating...")
              : (t("admin.coupons.dialog.submit") ?? "Create coupon")}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Code */}
        <div>
          <label className="block text-sm font-semibold mb-1.5">
            {t("admin.coupons.dialog.codeLabel")}
          </label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={t("admin.coupons.dialog.codePlaceholder")}
            className="w-full px-3 py-2.5 border border-border rounded-xl text-sm font-mono uppercase tracking-wider outline-none focus:border-primary"
          />
          {fieldErrors.code ? (
            <p className="mt-1 text-xs text-red-500">{fieldErrors.code}</p>
          ) : null}
        </div>

        {/* Type */}
        <div>
          <span className="block text-sm font-semibold mb-2">
            {t("admin.coupons.dialog.typeLabel")}
          </span>
          <div className="grid grid-cols-3 gap-2">
            {COUPON_FORM_TYPES.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setType(opt)}
                className="py-2 rounded-xl text-sm font-medium border transition-colors"
                style={
                  type === opt
                    ? { background: "var(--admin-primary)", color: "white", borderColor: "var(--admin-primary)" }
                    : { background: "white", color: "var(--admin-muted)", borderColor: "var(--admin-border)" }
                }
              >
                {opt === "PERCENT"
                  ? t("admin.coupons.dialog.typePercent")
                  : opt === "FIXED"
                  ? t("admin.coupons.dialog.typeFixed")
                  : t("admin.coupons.dialog.typeFreeShipping")}
              </button>
            ))}
          </div>
        </div>

        {/* Value */}
        <div>
          <label className="block text-sm font-semibold mb-1.5">
            {type === "PERCENT"
              ? t("admin.coupons.dialog.valueLabelPercent")
              : type === "FIXED"
              ? t("admin.coupons.dialog.valueLabelFixed")
              : t("admin.coupons.dialog.valueLabelFreeShipping")}
          </label>
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            min={type === "FREE_SHIPPING" ? 0 : 1}
            max={type === "PERCENT" ? 100 : undefined}
            className="w-full px-3 py-2.5 border border-border rounded-xl text-sm outline-none focus:border-primary"
          />
          {fieldErrors.value ? (
            <p className="mt-1 text-xs text-red-500">{fieldErrors.value}</p>
          ) : null}
        </div>

        {/* Min order / Max discount */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold mb-1.5">
              {t("admin.coupons.dialog.minOrderLabel")}
            </label>
            <input
              type="number"
              value={minOrderValue}
              onChange={(e) => setMinOrderValue(e.target.value)}
              placeholder={t("admin.coupons.dialog.minOrderPlaceholder")}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm outline-none focus:border-primary"
            />
          </div>
          {type === "PERCENT" ? (
            <div>
              <label className="block text-sm font-semibold mb-1.5">
                {t("admin.coupons.dialog.maxDiscountLabel")}
              </label>
              <input
                type="number"
                value={maxDiscount}
                onChange={(e) => setMaxDiscount(e.target.value)}
                placeholder={t("admin.coupons.dialog.maxDiscountPlaceholder")}
                className="w-full px-3 py-2.5 border border-border rounded-xl text-sm outline-none focus:border-primary"
              />
            </div>
          ) : null}
        </div>

        {/* Max uses */}
        <div>
          <label className="block text-sm font-semibold mb-1.5">
            {t("admin.coupons.dialog.maxUsesLabel") ?? "Max uses"}
          </label>
          <input
            type="number"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            min={1}
            className="w-full px-3 py-2.5 border border-border rounded-xl text-sm outline-none focus:border-primary"
          />
          {fieldErrors.maxUses ? (
            <p className="mt-1 text-xs text-red-500">{fieldErrors.maxUses}</p>
          ) : null}
        </div>

        {/* Per user limit */}
        <div>
          <label className="block text-sm font-semibold mb-1.5">
            {t("admin.coupons.dialog.perUserLimitLabel") ?? "Per user limit (optional)"}
          </label>
          <input
            type="number"
            value={perUserLimit}
            onChange={(e) => setPerUserLimit(e.target.value)}
            min={1}
            placeholder="e.g. 1"
            className="w-full px-3 py-2.5 border border-border rounded-xl text-sm outline-none focus:border-primary"
          />
        </div>

        {/* Valid until */}
        <div>
          <label className="block text-sm font-semibold mb-1.5">
            {t("admin.coupons.dialog.validUntilLabel") ?? "Valid until"}
          </label>
          <input
            type="datetime-local"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="w-full px-3 py-2.5 border border-border rounded-xl text-sm outline-none focus:border-primary"
          />
          {fieldErrors.validUntil ? (
            <p className="mt-1 text-xs text-red-500">{fieldErrors.validUntil}</p>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
