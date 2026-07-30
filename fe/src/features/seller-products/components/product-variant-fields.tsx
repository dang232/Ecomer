/**
 * ProductEditorDrawer sub-component: Variants, pricing, and inventory.
 */

import { IconPlus, IconTrash } from "@tabler/icons-react";
import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";


import type { SellerProductForm } from "../model/product-form";

interface ProductVariantFieldsProps {
  form: UseFormReturn<SellerProductForm>;
  disabled?: boolean;
}

export function ProductVariantFields({ form, disabled }: ProductVariantFieldsProps) {
  const { t } = useTranslation();
  const { watch, setValue, formState: { errors } } = form;

  const variants = watch("variants") ?? [];

  const addVariant = () => {
    setValue("variants", [
      ...variants,
      { sku: "", name: "", priceAmount: 0, stockQuantity: 0 },
    ], { shouldValidate: false });
  };

  const removeVariant = (index: number) => {
    if (variants.length <= 1) return; // min 1
    setValue(
      "variants",
      variants.filter((_, i) => i !== index),
      { shouldValidate: false },
    );
  };

  const updateVariant = <K extends keyof SellerProductForm["variants"][number]>(
    index: number,
    field: K,
    value: SellerProductForm["variants"][number][K],
  ) => {
    const updated = variants.map((v, i) =>
      i === index ? { ...v, [field]: value } : v,
    );
    setValue("variants", updated, { shouldValidate: false });
  };

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="sr-only">{t("seller.products.editor.variants.legend")}</legend>

      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">
          {t("seller.products.editor.variants.label")}
        </span>
        <button
          type="button"
          onClick={addVariant}
          disabled={disabled}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors disabled:opacity-50"
        >
          <IconPlus size={12} aria-hidden="true" />
          {t("seller.products.editor.variants.add")}
        </button>
      </div>

      <div className="space-y-2">
        {variants.map((variant, index) => (
          <div
            key={variant.sku || `variant-${index}`}
            className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-2 items-end rounded-[var(--radius-md)] border border-border p-3 bg-card"
          >
            {/* SKU */}
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1">
                {t("seller.products.editor.variants.sku")}
              </label>
              <input
                type="text"
                value={variant.sku}
                onChange={(e) => updateVariant(index, "sku", e.target.value)}
                disabled={disabled}
                placeholder="SKU-001"
                className="w-full px-3 py-2 border rounded-[var(--radius-sm)] text-xs outline-none focus:border-primary bg-background disabled:opacity-50"
                aria-label={`${t("seller.products.editor.variants.sku")} ${index + 1}`}
              />
            </div>

            {/* Name */}
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1">
                {t("seller.products.editor.variants.name")}
              </label>
              <input
                type="text"
                value={variant.name}
                onChange={(e) => updateVariant(index, "name", e.target.value)}
                disabled={disabled}
                placeholder="Blue / M"
                className="w-full px-3 py-2 border rounded-[var(--radius-sm)] text-xs outline-none focus:border-primary bg-background disabled:opacity-50"
                aria-label={`${t("seller.products.editor.variants.name")} ${index + 1}`}
              />
            </div>

            {/* Price */}
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1">
                {t("seller.products.editor.variants.price")}
              </label>
              <input
                type="number"
                value={variant.priceAmount}
                onChange={(e) => updateVariant(index, "priceAmount", Number(e.target.value))}
                disabled={disabled}
                min={0}
                placeholder="0"
                className="w-full px-3 py-2 border rounded-[var(--radius-sm)] text-xs outline-none focus:border-primary bg-background disabled:opacity-50"
                aria-label={`${t("seller.products.editor.variants.price")} ${index + 1}`}
              />
            </div>

            {/* Stock */}
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1">
                {t("seller.products.editor.variants.stock")}
              </label>
              <input
                type="number"
                value={variant.stockQuantity}
                onChange={(e) => updateVariant(index, "stockQuantity", parseInt(e.target.value) || 0)}
                disabled={disabled}
                min={0}
                placeholder="0"
                className="w-full px-3 py-2 border rounded-[var(--radius-sm)] text-xs outline-none focus:border-primary bg-background disabled:opacity-50"
                aria-label={`${t("seller.products.editor.variants.stock")} ${index + 1}`}
              />
            </div>

            {/* Remove */}
            <button
              type="button"
              onClick={() => removeVariant(index)}
              disabled={disabled || variants.length <= 1}
              aria-label={t("seller.products.editor.variants.remove")}
              className="mb-px w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] text-muted-foreground hover:text-error hover:bg-error-light transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <IconTrash size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      {errors.variants ? <p className="text-xs text-error" role="alert">
          {String(errors.variants.message ?? "")}
        </p> : null}
    </fieldset>
  );
}
