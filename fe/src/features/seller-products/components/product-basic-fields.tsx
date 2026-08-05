/**
 * ProductEditorDrawer sub-component: Basic information fields.
 * Used inside the drawer form via React Hook Form.
 */

import { useMemo } from "react";
import {
  Controller,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";
import { useTranslation } from "react-i18next";

import type { Category } from "@/shared/contracts";

import type { SellerProductForm } from "../model/product-form";

interface ProductBasicFieldsProps {
  register: UseFormRegister<SellerProductForm>;
  control: Control<SellerProductForm>;
  errors: FieldErrors<SellerProductForm>;
  categories: Category[];
  categoriesLoading?: boolean;
  categoriesError?: boolean;
  disabled?: boolean;
}

interface CategoryOption {
  id: string;
  label: string;
}

function flattenCategoryOptions(categories: Category[], depth = 0): CategoryOption[] {
  return categories.flatMap((category) => {
    const label = category.label?.trim() || category.name?.trim() || category.id;
    const prefix = depth > 0 ? `${"  ".repeat(depth)}- ` : "";
    return [
      { id: category.id, label: `${prefix}${label}` },
      ...flattenCategoryOptions((category.children ?? []) as Category[], depth + 1),
    ];
  });
}

export function ProductBasicFields({
  register,
  control,
  errors,
  categories,
  categoriesLoading = false,
  categoriesError = false,
  disabled,
}: ProductBasicFieldsProps) {
  const { t } = useTranslation();
  const selectedCategoryId = useWatch({ control, name: "categoryId" });
  const categoryOptions = useMemo(() => flattenCategoryOptions(categories), [categories]);
  const hasSelectedCategory = categoryOptions.some(
    (category) => category.id === selectedCategoryId,
  );

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
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="product-category"
            className="block text-sm font-semibold text-foreground mb-1.5"
          >
            {t("seller.products.editor.basic.categoryLabel")} *
          </label>
          <select
            id="product-category"
            {...(categoriesLoading ? { "aria-busy": true } : {})}
            {...register("categoryId")}
            disabled={disabled || categoriesLoading}
            className="w-full px-4 py-2.5 border rounded-[var(--radius-md)] text-sm outline-none focus:border-primary bg-card disabled:opacity-50"
            aria-invalid={!!errors.categoryId}
            aria-describedby={
              errors.categoryId
                ? "product-category-error"
                : categoriesError
                  ? "product-category-load-error"
                  : undefined
            }
          >
            <option value="">
              {categoriesLoading
                ? t("seller.products.editor.basic.categoryLoading")
                : t("seller.products.editor.basic.categoryPlaceholder")}
            </option>
            {!hasSelectedCategory && selectedCategoryId ? (
              <option value={selectedCategoryId}>{selectedCategoryId}</option>
            ) : null}
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
          {errors.categoryId ? (
            <p id="product-category-error" className="mt-1 text-xs text-error" role="alert">
              {errors.categoryId.message}
            </p>
          ) : null}
          {categoriesError ? (
            <p id="product-category-load-error" className="mt-1 text-xs text-muted-foreground">
              {t("seller.products.editor.basic.categoryLoadError")}
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
        <Controller
          name="tags"
          control={control}
          render={({ field }) => (
            <input
              id="product-tags"
              type="text"
              autoComplete="off"
              ref={field.ref}
              name={field.name}
              value={Array.isArray(field.value) ? field.value.join(", ") : ""}
              onBlur={field.onBlur}
              onChange={(event) =>
                field.onChange(
                  event.target.value
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                )
              }
              className="w-full px-4 py-2.5 border rounded-[var(--radius-md)] text-sm outline-none focus:border-primary bg-card disabled:opacity-50"
              placeholder={t("seller.products.editor.basic.tagsPlaceholder")}
              aria-invalid={!!errors.tags}
              aria-describedby={errors.tags ? "product-tags-error" : undefined}
            />
          )}
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
