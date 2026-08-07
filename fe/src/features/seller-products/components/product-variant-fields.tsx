/** Seller offer, pricing, inventory, and customer-selectable option fields. */

import { Plus, Trash2 } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { Controller, useFieldArray, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Button, SegmentedControl } from "@/shared/ui";
import { formatGroupedNumber, parseGroupedNumber } from "@/shared/lib/format";

import type { SellerProductForm, SellerProductOfferMode } from "../model/product-form";

interface ProductVariantFieldsProps {
  form: UseFormReturn<SellerProductForm>;
  disabled?: boolean;
}

const newVariant = () => ({
  sku: "",
  name: "",
  priceAmount: 0,
  stockQuantity: 0,
});

export function ProductVariantFields({ form, disabled }: ProductVariantFieldsProps) {
  const { t } = useTranslation();
  const {
    control,
    setValue,
    formState: { errors },
  } = form;
  const offerMode = useWatch({ control, name: "offerMode" });
  const { append, fields, remove } = useFieldArray({ control, name: "variants" });

  const setOfferMode = (nextMode: SellerProductOfferMode) => {
    if (nextMode === "variants" && fields.length === 0) append(newVariant());
    setValue("offerMode", nextMode, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
  };

  return (
    <fieldset className="space-y-4" disabled={disabled}>
      <legend className="sr-only">{t("seller.products.editor.variants.legend")}</legend>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">
          {t("seller.products.editor.variants.label")}
        </p>
        <SegmentedControl
          ariaLabel={t("seller.products.editor.variants.modeLabel")}
          value={offerMode}
          items={[
            {
              value: "single",
              label: t("seller.products.editor.variants.modeSingle"),
            },
            {
              value: "variants",
              label: t("seller.products.editor.variants.modeVariants"),
            },
          ]}
          onValueChange={setOfferMode}
        />
        <p className="text-xs text-muted-foreground">
          {t(
            offerMode === "single"
              ? "seller.products.editor.variants.singleHint"
              : "seller.products.editor.variants.variantsHint",
          )}
        </p>
      </div>

      {offerMode === "single" ? (
        <SingleOfferFields form={form} />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">
              {t("seller.products.editor.variants.optionListLabel")}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append(newVariant())}
              disabled={disabled || fields.length >= 50}
            >
              <Plus size={15} aria-hidden="true" />
              {t("seller.products.editor.variants.add")}
            </Button>
          </div>

          {fields.map((field, index) => (
            <VariantCard
              key={field.id}
              form={form}
              index={index}
              canRemove={fields.length > 1}
              onRemove={() => remove(index)}
              disabled={disabled}
            />
          ))}

          {errors.variants && !Array.isArray(errors.variants) ? (
            <p className="text-xs text-error" role="alert">
              {String(errors.variants.message ?? "")}
            </p>
          ) : null}
        </div>
      )}
    </fieldset>
  );
}

function SingleOfferFields({ form }: { form: UseFormReturn<SellerProductForm> }) {
  const { t } = useTranslation();
  const {
    control,
    register,
    formState: { errors },
  } = form;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <CurrencyField
        control={control}
        name="offer.priceAmount"
        label={`${t("seller.products.editor.variants.price")} *`}
        hint={t("seller.products.editor.variants.currency")}
        error={errors.offer?.priceAmount?.message}
        inputId="product-offer-price"
      />
      <NumberField
        register={register}
        name="offer.stockQuantity"
        label={t("seller.products.editor.variants.stock")}
        hint={t("seller.products.editor.variants.stockHint")}
        error={errors.offer?.stockQuantity?.message}
        inputId="product-offer-stock"
      />
      <MerchantSkuField
        register={register}
        name="offer.sku"
        error={errors.offer?.sku?.message}
        inputId="product-offer-sku"
      />
    </div>
  );
}

function VariantCard({
  form,
  index,
  canRemove,
  onRemove,
  disabled,
}: {
  form: UseFormReturn<SellerProductForm>;
  index: number;
  canRemove: boolean;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const {
    control,
    register,
    formState: { errors },
  } = form;
  const variantError = errors.variants?.[index];
  const name = `variants.${index}.name` as const;
  const price = `variants.${index}.priceAmount` as const;
  const stock = `variants.${index}.stockQuantity` as const;
  const sku = `variants.${index}.sku` as const;

  return (
    <article className="space-y-3 border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-foreground">
          {t("seller.products.editor.variants.itemTitle", { number: index + 1 })}
        </h4>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled || !canRemove}
          aria-label={t("seller.products.editor.variants.remove")}
          className="inline-flex min-h-[var(--target-web)] min-w-[var(--target-web)] items-center justify-center rounded-[var(--radius-sm)] text-muted-foreground transition-colors hover:bg-error-light hover:text-error disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label={`${t("seller.products.editor.variants.name")} *`}
          error={variantError?.name?.message}
          inputId={`product-variant-${index}-name`}
        >
          <input
            id={`product-variant-${index}-name`}
            type="text"
            autoComplete="off"
            placeholder={t("seller.products.editor.variants.namePlaceholder")}
            {...register(name)}
            className={inputClass(Boolean(variantError?.name))}
            aria-invalid={Boolean(variantError?.name)}
          />
        </Field>

        <CurrencyField
          control={control}
          name={price}
          label={`${t("seller.products.editor.variants.price")} *`}
          hint={t("seller.products.editor.variants.currency")}
          error={variantError?.priceAmount?.message}
          inputId={`product-variant-${index}-price`}
        />

        <NumberField
          register={register}
          name={stock}
          label={t("seller.products.editor.variants.stock")}
          hint={t("seller.products.editor.variants.stockHint")}
          error={variantError?.stockQuantity?.message}
          inputId={`product-variant-${index}-stock`}
        />
      </div>

      <MerchantSkuField
        register={register}
        name={sku}
        error={variantError?.sku?.message}
        inputId={`product-variant-${index}-sku`}
      />
    </article>
  );
}

function CurrencyField({
  control,
  name,
  label,
  hint,
  error,
  inputId,
}: {
  control: UseFormReturn<SellerProductForm>["control"];
  name: "offer.priceAmount" | `variants.${number}.priceAmount`;
  label: string;
  hint: string;
  error?: string;
  inputId: string;
}) {
  const { t } = useTranslation();
  return (
    <Field label={label} hint={hint} error={error} inputId={inputId}>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <input
            id={inputId}
            type="text"
            inputMode="numeric"
            value={formatGroupedNumber(field.value)}
            placeholder={t("seller.products.editor.variants.pricePlaceholder")}
            onChange={(event) => field.onChange(parseGroupedNumber(event.target.value))}
            className={inputClass(Boolean(error))}
            aria-invalid={Boolean(error)}
          />
        )}
      />
    </Field>
  );
}

function NumberField({
  register,
  name,
  label,
  hint,
  error,
  inputId,
}: {
  register: UseFormReturn<SellerProductForm>["register"];
  name: "offer.stockQuantity" | `variants.${number}.stockQuantity`;
  label: string;
  hint: string;
  error?: string;
  inputId: string;
}) {
  const { t } = useTranslation();
  return (
    <Field label={label} hint={hint} error={error} inputId={inputId}>
      <input
        id={inputId}
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        placeholder={t("seller.products.editor.variants.stockPlaceholder")}
        {...register(name, { setValueAs: (value) => (value === "" ? 0 : Number(value)) })}
        className={inputClass(Boolean(error))}
        aria-invalid={Boolean(error)}
      />
    </Field>
  );
}

function MerchantSkuField({
  register,
  name,
  error,
  inputId,
}: {
  register: UseFormReturn<SellerProductForm>["register"];
  name: "offer.sku" | `variants.${number}.sku`;
  error?: string;
  inputId: string;
}) {
  const { t } = useTranslation();
  return (
    <details className="border-t border-border pt-3">
      <summary className="cursor-pointer text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">
        {t("seller.products.editor.variants.skuDisclosure")}
      </summary>
      <div className="mt-3">
        <Field
          label={t("seller.products.editor.variants.sku")}
          hint={t("seller.products.editor.variants.skuHint")}
          error={error}
          inputId={inputId}
        >
          <input
            id={inputId}
            type="text"
            autoComplete="off"
            placeholder={t("seller.products.editor.variants.skuPlaceholder")}
            {...register(name)}
            className={inputClass(Boolean(error))}
            aria-invalid={Boolean(error)}
          />
        </Field>
      </div>
    </details>
  );
}

function inputClass(hasError: boolean): string {
  return `w-full rounded-[var(--radius-sm)] border px-3 py-2.5 text-sm outline-none focus:border-primary bg-background disabled:opacity-50 ${
    hasError ? "border-error" : "border-border"
  }`;
}

function Field({
  label,
  hint,
  error,
  inputId,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  inputId: string;
  children: React.ReactNode;
}) {
  const errorId = `${inputId}-error`;
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <label htmlFor={inputId} className="text-xs font-semibold text-foreground">
          {label}
        </label>
        {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
      {error ? (
        <p id={errorId} className="mt-1 text-xs text-error" role="alert">
          {String(error)}
        </p>
      ) : null}
    </div>
  );
}
