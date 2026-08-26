import { useMutation } from "@tanstack/react-query";
import { AlertCircle, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ApiError } from "@/shared/api";
import { addAddress } from "@/shared/api/endpoints/users";
import type { Address } from "@/shared/contracts/api";
import { addressKey } from "@/shared/lib";
import { Modal } from "@/shared/ui";

import { formatAddressLine } from "./format";

interface Props {
  addresses: Address[];
  selectedAddressIndex: number;
  setSelectedAddressIndex: (i: number) => void;
  buyerName: string;
  isLoading: boolean;
  refetchAddresses: () => Promise<unknown>;
}

interface AddressFormState {
  street: string;
  ward: string;
  district: string;
  city: string;
}

const EMPTY_FORM: AddressFormState = { street: "", ward: "", district: "", city: "" };

export function CheckoutAddressStep({
  addresses,
  selectedAddressIndex,
  setSelectedAddressIndex,
  buyerName,
  isLoading,
  refetchAddresses,
}: Props) {
  const { t } = useTranslation();
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState<AddressFormState>(EMPTY_FORM);

  const addMutation = useMutation({
    mutationFn: (body: Address) => addAddress(body),
    onSuccess: async (data) => {
      const newIndex = (data.addresses?.length ?? 1) - 1;
      setShowAddModal(false);
      setForm(EMPTY_FORM);
      await refetchAddresses();
      setSelectedAddressIndex(newIndex);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : t("checkout.address.addError"));
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.street || !form.district || !form.city) return;
    addMutation.mutate({
      street: form.street,
      ward: form.ward || undefined,
      district: form.district,
      city: form.city,
    });
  };

  const setField = (field: keyof AddressFormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="space-y-4">
      <h2 className="font-bold text-foreground text-lg mb-4">{t("checkout.address.header")}</h2>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("checkout.address.loading")}</p>
      ) : null}
      {!isLoading && addresses.length === 0 ? (
        <div className="bg-card rounded-[var(--radius-lg)] p-5 text-sm text-muted-foreground flex items-start gap-3">
          <AlertCircle size={18} className="text-orange-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-foreground">
              {t("checkout.address.noAddressesTitle")}
            </p>
            <p className="mt-1">{t("checkout.address.noAddressesSub")}</p>
          </div>
        </div>
      ) : null}
      <div role="radiogroup" aria-label={t("checkout.address.groupLabel")} className="space-y-3">
        {addresses.map((addr, i) => {
          const isSelected = selectedAddressIndex === i;
          const inputId = `checkout-address-${i}`;
          return (
            <label
              key={addressKey(addr)}
              htmlFor={inputId}
              className={[
                "w-full flex gap-3 p-4 border-[1.5px] rounded-[var(--radius-lg)] cursor-pointer transition-all text-left",
                "peer-focus-within:ring-2 peer-focus-within:ring-primary peer-focus-within:ring-offset-2",
                isSelected
                  ? "border-primary bg-[var(--primary-subtle)] shadow-[0_0_0_3px_oklch(from_var(--primary)_l_c_h_/_0.08)]"
                  : "border-border hover:border-border-hover hover:shadow-sm",
              ].join(" ")}
            >
              <input
                id={inputId}
                type="radio"
                name="checkout-address"
                value={i}
                checked={isSelected}
                onChange={() => setSelectedAddressIndex(i)}
                className="peer sr-only"
              />
              {/* Radio dot */}
              <div
                className={[
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all",
                  isSelected ? "border-primary" : "border-border",
                ].join(" ")}
              >
                {isSelected ? <div className="w-2.5 h-2.5 rounded-full bg-primary" /> : null}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center flex-wrap gap-1.5 mb-0.5">
                  <span className="font-semibold text-foreground text-sm">{buyerName}</span>
                  {addr.phone ? (
                    <>
                      <span className="text-muted-foreground text-xs">|</span>
                      <span className="text-muted-foreground text-xs">{addr.phone}</span>
                    </>
                  ) : null}
                  {addr.isDefault ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium border border-primary text-primary">
                      {t("checkout.address.isDefaultBadge")}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">{formatAddressLine(addr)}</p>
              </div>
            </label>
          );
        })}
      </div>

      <button
        onClick={() => setShowAddModal(true)}
        className="w-full flex items-center justify-center gap-2 py-3.5 border-[1.5px] border-dashed border-border rounded-[var(--radius-lg)] text-primary text-sm font-medium hover:border-primary hover:bg-primary-light transition-colors"
      >
        <Plus size={16} /> {t("checkout.address.addNew")}
      </button>

      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        dismissDisabled={addMutation.isPending}
        title={t("checkout.address.addNew")}
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              disabled={addMutation.isPending}
              className="flex-1 py-2.5 rounded-[var(--radius-lg)] border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              form="add-address-form"
              disabled={addMutation.isPending}
              className="flex-1 py-2.5 rounded-[var(--radius-lg)] bg-primary text-white text-sm font-semibold transition-opacity disabled:opacity-60"
            >
              {addMutation.isPending ? t("common.saving") : t("common.save")}
            </button>
          </>
        }
      >
        <form id="add-address-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t("checkout.address.form.street")} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.street}
              onChange={setField("street")}
              required
              className="w-full px-3 py-2 rounded-[var(--radius-lg)] border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={t("checkout.address.form.streetPlaceholder")}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t("checkout.address.form.ward")}
            </label>
            <input
              type="text"
              value={form.ward}
              onChange={setField("ward")}
              className="w-full px-3 py-2 rounded-[var(--radius-lg)] border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={t("checkout.address.form.wardPlaceholder")}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t("checkout.address.form.district")} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.district}
              onChange={setField("district")}
              required
              className="w-full px-3 py-2 rounded-[var(--radius-lg)] border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={t("checkout.address.form.districtPlaceholder")}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t("checkout.address.form.city")} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.city}
              onChange={setField("city")}
              required
              className="w-full px-3 py-2 rounded-[var(--radius-lg)] border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={t("checkout.address.form.cityPlaceholder")}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
