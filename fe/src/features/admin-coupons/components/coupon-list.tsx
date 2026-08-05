import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ApiError } from "@/shared/api";
import { adminListCoupons, adminDeactivateCoupon } from "@/shared/api/endpoints/admin";
import type { Coupon } from "@/shared/contracts/api";
import { formatPrice } from "@/shared/lib";

import { CouponEditor } from "./coupon-editor";

export function CouponList() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const {
    data: coupons = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["admin", "coupons"],
    queryFn: adminListCoupons,
    retry: false,
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => adminDeactivateCoupon(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "coupons"] });
      toast.success(t("admin.coupons.deactivateOk"));
      setSelectedId(null);
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("admin.coupons.deactivateErr")),
  });

  const selectedCoupon = selectedId ? coupons.find((c) => c.id === selectedId) : null;

  return (
    <>
      <CouponEditor open={showCreate} onClose={() => setShowCreate(false)} />
      {/* Detail drawer for existing coupons — read-only */}
      {selectedCoupon ? (
        <CouponDetailDrawer
          coupon={selectedCoupon}
          onClose={() => setSelectedId(null)}
          onDeactivate={() => deactivate.mutate(selectedCoupon.id)}
          isDeactivating={deactivate.isPending}
        />
      ) : null}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="divide-y divide-border px-5 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{t("admin.coupons.title")}</h2>
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
            style={{ background: "oklch(52% 0.2 270)" }}
          >
            {t("admin.coupons.create")}
          </button>
        </div>

        {isLoading ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            {t("admin.coupons.loading")}
          </div>
        ) : isError ? (
          <div className="px-5 py-8 text-center text-sm text-red-500">
            {t("admin.coupons.loadErr")}
          </div>
        ) : coupons.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            {t("admin.coupons.empty")}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                {["Code", "Type", "Value", "Status", ""].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {coupons.map((c) => (
                <tr key={c.id} className="hover:bg-muted">
                  <td className="px-4 py-3 text-sm font-mono font-bold">{c.code}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{c.type}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {c.type === "PERCENT" ? `${c.value}%` : formatPrice(c.value)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="rounded-full px-2.5 py-1 text-xs font-semibold"
                      style={{
                        background: c.active ? "var(--success-light)" : "var(--error-light)",
                        color: c.active ? "var(--success)" : "var(--error)",
                      }}
                    >
                      {c.active ? t("admin.coupons.active") : t("admin.coupons.inactive")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.active ? (
                      <button
                        onClick={() => deactivate.mutate(c.id)}
                        disabled={deactivate.isPending}
                        className="text-xs font-semibold text-red-500 disabled:opacity-50"
                      >
                        {t("admin.coupons.deactivate")}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

interface CouponDetailDrawerProps {
  coupon: Coupon;
  onClose: () => void;
  onDeactivate: () => void;
  isDeactivating: boolean;
}

function CouponDetailDrawer({
  coupon,
  onClose,
  onDeactivate,
  isDeactivating,
}: CouponDetailDrawerProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-end">
      <div
        className="h-full w-full max-w-md bg-card border-l border-border flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label={coupon.code}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-bold">{coupon.code}</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">{t("admin.coupons.th.type")}</p>
              <p className="font-semibold">{coupon.type}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t("admin.coupons.th.value")}</p>
              <p className="font-semibold">
                {coupon.type === "PERCENT" ? `${coupon.value}%` : formatPrice(coupon.value)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <span
                className="rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{
                  background: coupon.active ? "var(--success-light)" : "var(--error-light)",
                  color: coupon.active ? "var(--success)" : "var(--error)",
                }}
              >
                {coupon.active ? t("admin.coupons.active") : t("admin.coupons.inactive")}
              </span>
            </div>
            <div>
              <p className="text-muted-foreground">Max uses</p>
              <p className="font-semibold">{coupon.maxUses ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Current uses</p>
              <p className="font-semibold">{coupon.currentUses ?? 0}</p>
            </div>
            {coupon.minOrderValue ? (
              <div>
                <p className="text-muted-foreground">Min. order</p>
                <p className="font-semibold">{formatPrice(coupon.minOrderValue)}</p>
              </div>
            ) : null}
            {coupon.maxDiscount ? (
              <div>
                <p className="text-muted-foreground">Max discount</p>
                <p className="font-semibold">{formatPrice(coupon.maxDiscount)}</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="border-t border-border px-5 py-4 flex gap-3">
          {coupon.active ? (
            <button
              onClick={onDeactivate}
              disabled={isDeactivating}
              className="flex-1 rounded-xl border border-red-200 py-2.5 text-sm font-semibold text-red-500 disabled:opacity-50"
            >
              {isDeactivating
                ? (t("common.submitting") ?? "Submitting...")
                : (t("admin.coupons.deactivate") ?? "Deactivate")}
            </button>
          ) : null}
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-muted-foreground"
          >
            {t("common.close") ?? "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
