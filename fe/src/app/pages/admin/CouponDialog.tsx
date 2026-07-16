import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Modal } from "../../components/ui/modal";

interface CouponDialogBody {
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  minOrderValue?: number;
  maxDiscount?: number;
  /** BE CreateCouponRequest requires this — primitive int, must be > 0. */
  maxUses: number;
  /** BE CreateCouponRequest requires this — Instant, ISO-8601 string. */
  validUntil: string;
  active: boolean;
}

export function CouponDialog({
  open,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (body: CouponDialogBody) => void;
  isSubmitting: boolean;
}) {
  if (!open) return null;
  return <CouponDialogBodyView onClose={onClose} onSubmit={onSubmit} isSubmitting={isSubmitting} />;
}

function CouponDialogBodyView({
  onClose,
  onSubmit,
  isSubmitting,
}: {
  onClose: () => void;
  onSubmit: (body: CouponDialogBody) => void;
  isSubmitting: boolean;
}) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [type, setType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [value, setValue] = useState("");
  const [minOrderValue, setMinOrderValue] = useState("");
  const [maxDiscount, setMaxDiscount] = useState("");

  const handleSubmit = () => {
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode) {
      toast.error(t("admin.coupons.dialog.missingCode"));
      return;
    }
    const v = Number(value.replace(/\D/g, ""));
    if (!v || v <= 0) {
      toast.error(t("admin.coupons.dialog.invalidValue"));
      return;
    }
    if (type === "PERCENT" && v > 100) {
      toast.error(t("admin.coupons.dialog.percentTooLarge"));
      return;
    }
    onSubmit({
      code: trimmedCode,
      type,
      value: v,
      minOrderValue: minOrderValue
        ? Number(minOrderValue.replace(/\D/g, "")) || undefined
        : undefined,
      maxDiscount: maxDiscount ? Number(maxDiscount.replace(/\D/g, "")) || undefined : undefined,
      // BE CreateCouponRequest requires maxUses (primitive int) and
      // validUntil (Instant). The dialog doesn't surface either field
      // today; pre-fix this caused a 400 because Jackson couldn't
      // deserialize null into a primitive int. Send sensible defaults
      // until the dialog grows those inputs:
      //   - maxUses: 1000 (effectively unbounded for typical promos)
      //   - validUntil: 30 days from now
      maxUses: 1000,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      active: true,
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      dismissDisabled={isSubmitting}
      title={t("admin.coupons.dialog.title")}
      footer={
        <>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground disabled:opacity-50"
          >
            {t("admin.coupons.dialog.cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
            style={{ background: "var(--admin-primary)" }}
          >
            {isSubmitting ? t("admin.coupons.dialog.submitting") : t("admin.coupons.dialog.submit")}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label
            htmlFor="admin-coupon-code"
            className="block text-sm font-semibold text-foreground mb-1.5"
          >
            {t("admin.coupons.dialog.codeLabel")}
          </label>
          <input
            id="admin-coupon-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={t("admin.coupons.dialog.codePlaceholder")}
            className="w-full px-3 py-2.5 border border-border rounded-xl text-sm font-mono uppercase tracking-wider outline-none focus:border-[var(--admin-primary)]"
            // eslint-disable-next-line jsx-a11y/no-autofocus -- inside a modal opened by explicit user click; focusing the first input is expected UX
            autoFocus
          />
        </div>

        <div>
          <span className="block text-sm font-semibold text-foreground mb-2">
            {t("admin.coupons.dialog.typeLabel")}
          </span>
          <div className="grid grid-cols-2 gap-2">
            {(["PERCENT", "FIXED"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setType(opt)}
                className="py-2 rounded-xl text-sm font-medium border transition-colors"
                style={
                  type === opt
                    ? {
                        background: "var(--admin-primary)",
                        color: "white",
                        borderColor: "var(--admin-primary)",
                      }
                    : {
                        background: "white",
                        color: "var(--admin-muted)",
                        borderColor: "var(--admin-border)",
                      }
                }
              >
                {opt === "PERCENT"
                  ? t("admin.coupons.dialog.typePercent")
                  : t("admin.coupons.dialog.typeFixed")}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label
            htmlFor="admin-coupon-value"
            className="block text-sm font-semibold text-foreground mb-1.5"
          >
            {type === "PERCENT"
              ? t("admin.coupons.dialog.valueLabelPercent")
              : t("admin.coupons.dialog.valueLabelFixed")}
          </label>
          <input
            id="admin-coupon-value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={
              type === "PERCENT"
                ? t("admin.coupons.dialog.valuePlaceholderPercent")
                : t("admin.coupons.dialog.valuePlaceholderFixed")
            }
            className="w-full px-3 py-2.5 border border-border rounded-xl text-sm outline-none focus:border-[var(--admin-primary)]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="admin-coupon-min-order"
              className="block text-sm font-semibold text-foreground mb-1.5"
            >
              {t("admin.coupons.dialog.minOrderLabel")}
            </label>
            <input
              id="admin-coupon-min-order"
              value={minOrderValue}
              onChange={(e) => setMinOrderValue(e.target.value)}
              placeholder={t("admin.coupons.dialog.minOrderPlaceholder")}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm outline-none focus:border-[var(--admin-primary)]"
            />
          </div>
          {type === "PERCENT" ? (
            <div>
              <label
                htmlFor="admin-coupon-max-discount"
                className="block text-sm font-semibold text-foreground mb-1.5"
              >
                {t("admin.coupons.dialog.maxDiscountLabel")}
              </label>
              <input
                id="admin-coupon-max-discount"
                value={maxDiscount}
                onChange={(e) => setMaxDiscount(e.target.value)}
                placeholder={t("admin.coupons.dialog.maxDiscountPlaceholder")}
                className="w-full px-3 py-2.5 border border-border rounded-xl text-sm outline-none focus:border-[var(--admin-primary)]"
              />
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
