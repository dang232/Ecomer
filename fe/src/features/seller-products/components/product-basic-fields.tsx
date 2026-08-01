/**
 * ProductEditorDrawer sub-component: Basic information fields.
 * Used inside the drawer form via React Hook Form.
 */

import type { UseFormRegister, FieldErrors } from "react-hook-form";
import { useTranslation } from "react-i18next";

import type { SellerProductForm } from "../model/product-form";

interface ProductBasicFieldsProps {
  register: UseFormRegister<SellerProductForm>;
  errors: FieldErrors<SellerProductForm>;
  disabled?: boolean;
}

export function ProductBasicFields({ register, errors, disabled }: ProductBasicFieldsProps) {
  const { t } = useTranslation();

  return (
    <fieldset className="space-y-4" disabled={disabled}>
      <legend className="sr-only">{t("seller.products.editor.basic.legend")}</legend>

      {/* Name */}
      <div>
        <label
          htmlFor="product-name"
          className="block text-sm font-semibold text-foreground mb-1.5"
        >
          {t("seller.products.editor.basic.nameLabel")} *
        </label>
        <input
          id="product-name"
          type="text"
          autoComplete="off"
          {...register("name")}
          className="w-full px-4 py-2.5 border rounded-[var(--radius-md)] text-sm outline-none focus:border-primary bg-card disabled:opacity-50"
          placeholder={t("seller.products.editor.basic.namePlaceholder")}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "product-name-error" : undefined}
        />
        {errors.name ? (
          <p id="product-name-error" className="mt-1 text-xs text-error" role="alert">
            {errors.name.message}
          </p>
        ) : null}
      </div>

      {/* Description */}
      <div>
        <label
          htmlFor="product-description"
          className="block text-sm font-semibold text-foreground mb-1.5"
        >
          {t("seller.products.editor.basic.descriptionLabel")}
        </label>
        <textarea
          id="product-description"
          rows={3}
          {...register("description")}
          className="w-full px-4 py-2.5 border rounded-[var(--radius-md)] text-sm outline-none focus:border-primary resize-none bg-card disabled:opacity-50"
          placeholder={t("seller.products.editor.basic.descriptionPlaceholder")}
          aria-invalid={!!errors.description}
          aria-describedby={errors.description ? "product-description-error" : undefined}
        />
        {errors.description ? (
          <p id="product-description-error" className="mt-1 text-xs text-error" role="alert">
            {errors.description.message}
          </p>
        ) : null}
      </div>

      {/* Category + Brand */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="product-category"
            className="block text-sm font-semibold text-foreground mb-1.5"
          >
            {t("seller.products.editor.basic.categoryLabel")} *
          </label>
          <input
            id="product-category"
            type="text"
            autoComplete="off"
            {...register("categoryId")}
            className="w-full px-4 py-2.5 border rounded-[var(--radius-md)] text-sm outline-none focus:border-primary bg-card disabled:opacity-50"
            placeholder="electronics"
            aria-invalid={!!errors.categoryId}
            aria-describedby={errors.categoryId ? "product-category-error" : undefined}
          />
          {errors.categoryId ? (
            <p id="product-category-error" className="mt-1 text-xs text-error" role="alert">
              {errors.categoryId.message}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="product-brand"
            className="block text-sm font-semibold text-foreground mb-1.5"
          >
            {t("seller.products.editor.basic.brandLabel")}
          </label>
          <input
            id="product-brand"
            type="text"
            autoComplete="off"
            {...register("brand")}
            className="w-full px-4 py-2.5 border rounded-[var(--radius-md)] text-sm outline-none focus:border-primary bg-card disabled:opacity-50"
            placeholder="Samsung"
            aria-invalid={!!errors.brand}
          />
          {errors.brand ? (
            <p className="mt-1 text-xs text-error" role="alert">
              {errors.brand.message}
            </p>
          ) : null}
        </div>
      </div>

      {/* Tags */}
      <div>
        <label
          htmlFor="product-tags"
          className="block text-sm font-semibold text-foreground mb-1.5"
        >
          {t("seller.products.editor.basic.tagsLabel")}
        </label>
        <input
          id="product-tags"
          type="text"
          autoComplete="off"
          {...register("tags")}
          className="w-full px-4 py-2.5 border rounded-[var(--radius-md)] text-sm outline-none focus:border-primary bg-card disabled:opacity-50"
          placeholder={t("seller.products.editor.basic.tagsPlaceholder")}
          aria-invalid={!!errors.tags}
          aria-describedby={errors.tags ? "product-tags-error" : undefined}
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          {t("seller.products.editor.basic.tagsHint")}
        </p>
        {errors.tags ? (
          <p id="product-tags-error" className="mt-1 text-xs text-error" role="alert">
            {errors.tags.message}
          </p>
        ) : null}
      </div>
    </fieldset>
  );
}
