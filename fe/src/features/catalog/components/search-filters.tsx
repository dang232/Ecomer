import { SlidersHorizontal, Star } from "lucide-react";
import { useTranslation } from "react-i18next";

import { categoryDisplayLabel } from "../../../app/hooks/use-categories";
import type { SearchFacets } from "../../../app/lib/api/endpoints/search";
import type { Category } from "../../../app/types/api";
import { Button } from "../../../shared/ui/button";

export interface SearchFilterValues {
  selectedCategory: string;
  selectedBrand: string;
  priceMin: string;
  priceMax: string;
  minRating: number;
  selectedTags: string[];
  sameDay: boolean;
  verifiedOnly: boolean;
  officialOnly: boolean;
}

interface SearchFiltersProps {
  idPrefix: string;
  categories: Category[];
  facets: SearchFacets;
  values: SearchFilterValues;
  hasActiveFilters: boolean;
  priceError: string | null;
  onClear: () => void;
  onCategoryChange: (category: string) => void;
  onBrandChange: (brand: string) => void;
  onPriceMinChange: (value: string) => void;
  onPriceMaxChange: (value: string) => void;
  onApplyPrice: () => void;
  onRatingChange: (rating: number) => void;
  onTagsChange: (value: string[]) => void;
  onSameDayChange: (value: boolean) => void;
  onVerifiedChange: (value: boolean) => void;
  onOfficialChange: (value: boolean) => void;
}

const optionClass =
  "flex min-h-[var(--target-web)] cursor-pointer items-center gap-2 rounded-[var(--radius-control)] px-1 text-sm text-foreground hover:bg-muted";

export function SearchFilters({
  idPrefix,
  categories,
  facets,
  values,
  hasActiveFilters,
  priceError,
  onClear,
  onCategoryChange,
  onBrandChange,
  onPriceMinChange,
  onPriceMaxChange,
  onApplyPrice,
  onRatingChange,
  onTagsChange,
  onSameDayChange,
  onVerifiedChange,
  onOfficialChange,
}: SearchFiltersProps) {
  const { t } = useTranslation();
  const priceErrorId = `${idPrefix}-price-error`;
  const categoryCounts = new Map(facets.categories.map((entry) => [entry.key, entry.count]));

  return (
    <div className="space-y-5">
      <div className="flex min-h-[var(--target-web)] items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          <span>{t("search.filtersTitle", { defaultValue: "Filters" })}</span>
        </div>
        {hasActiveFilters ? (
          <Button variant="ghost" size="sm" onClick={onClear} className="px-2 text-primary">
            {t("search.clearAll", { defaultValue: "Clear all" })}
          </Button>
        ) : null}
      </div>

      <fieldset className="border-t border-border pt-4">
        <legend className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
          {t("search.categoriesTitle", { defaultValue: "Category" })}
        </legend>
        <div className="max-h-56 space-y-0.5 overflow-y-auto pr-1">
          <label className={optionClass}>
            <input
              type="radio"
              name={`${idPrefix}-category`}
              checked={!values.selectedCategory}
              onChange={() => onCategoryChange("")}
              className="h-4 w-4 accent-primary"
            />
            <span>{t("search.allCategories", { defaultValue: "All categories" })}</span>
          </label>
          {categories.map((category) => {
            const count = categoryCounts.get(category.id);
            return (
              <label key={category.id} className={optionClass}>
                <input
                  type="radio"
                  name={`${idPrefix}-category`}
                  checked={values.selectedCategory === category.id}
                  onChange={() => onCategoryChange(category.id)}
                  className="h-4 w-4 accent-primary"
                />
                <span className="min-w-0 flex-1 break-words">{categoryDisplayLabel(category)}</span>
                {count !== undefined ? (
                  <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
                ) : null}
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="border-t border-border pt-4">
        <legend className="mb-3 text-xs font-semibold uppercase text-muted-foreground">
          {t("search.priceHeader", { defaultValue: "Price (thousand ₫)" })}
        </legend>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
          <label className="grid gap-1 text-xs text-muted-foreground">
            <span>{t("search.priceFrom", { defaultValue: "From" })}</span>
            <input
              value={values.priceMin}
              onChange={(event) => onPriceMinChange(event.target.value)}
              inputMode="numeric"
              autoComplete="off"
              aria-invalid={priceError ? true : undefined}
              aria-describedby={priceError ? priceErrorId : undefined}
              className="min-h-[var(--target-web)] min-w-0 rounded-[var(--radius-control)] border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring"
            />
          </label>
          <span className="pb-3 text-muted-foreground" aria-hidden="true">
            –
          </span>
          <label className="grid gap-1 text-xs text-muted-foreground">
            <span>{t("search.priceTo", { defaultValue: "To" })}</span>
            <input
              value={values.priceMax}
              onChange={(event) => onPriceMaxChange(event.target.value)}
              inputMode="numeric"
              autoComplete="off"
              aria-invalid={priceError ? true : undefined}
              aria-describedby={priceError ? priceErrorId : undefined}
              className="min-h-[var(--target-web)] min-w-0 rounded-[var(--radius-control)] border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring"
            />
          </label>
        </div>
        {priceError ? (
          <p id={priceErrorId} role="alert" className="mt-2 text-xs text-error">
            {priceError}
          </p>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          onClick={onApplyPrice}
          disabled={Boolean(priceError)}
          className="mt-3 w-full"
        >
          {t("search.priceApply", { defaultValue: "Apply price" })}
        </Button>
      </fieldset>

      <fieldset className="border-t border-border pt-4">
        <legend className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
          {t("search.ratingHeader", { defaultValue: "Rating" })}
        </legend>
        {[5, 4, 3].map((rating) => (
          <label key={rating} className={optionClass}>
            <input
              type="radio"
              name={`${idPrefix}-rating`}
              checked={values.minRating === rating}
              onChange={() => onRatingChange(values.minRating === rating ? 0 : rating)}
              className="h-4 w-4 accent-primary"
            />
            <span className="flex items-center gap-1">
              {Array.from({ length: rating }, (_, index) => (
                <Star
                  key={`${rating}-${index}`}
                  className="h-3.5 w-3.5 text-[var(--rating)]"
                  fill="currentColor"
                  aria-hidden="true"
                />
              ))}
              <span className="ml-1">{t("search.andUp", { defaultValue: "& up" })}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="border-t border-border pt-4">
        <legend className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
          {t("search.shippingHeader", { defaultValue: "Shipping" })}
        </legend>
        <label className={optionClass}>
          <input
            type="checkbox"
            checked={values.sameDay}
            onChange={(event) => onSameDayChange(event.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          <span>{t("search.sameDayDelivery", { defaultValue: "Same-day delivery" })}</span>
        </label>
      </fieldset>

      {facets.tags.length > 0 ? (
        <fieldset className="border-t border-border pt-4">
          <legend className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            {t("search.tagsHeader", { defaultValue: "Tags" })}
          </legend>
          <div className="max-h-52 space-y-0.5 overflow-y-auto pr-1">
            {facets.tags.map((entry) => {
              const selected = values.selectedTags.includes(entry.key);
              return (
                <label key={entry.key} className={optionClass}>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() =>
                      onTagsChange(
                        selected
                          ? values.selectedTags.filter((tag) => tag !== entry.key)
                          : [...values.selectedTags, entry.key],
                      )
                    }
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="min-w-0 flex-1 break-words">{entry.label ?? entry.key}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{entry.count}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <fieldset className="border-t border-border pt-4">
        <legend className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
          {t("search.sellerTitle", { defaultValue: "Seller" })}
        </legend>
        <label className={optionClass}>
          <input
            type="checkbox"
            checked={values.verifiedOnly}
            onChange={(event) => onVerifiedChange(event.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          <span>{t("search.verifiedOnly", { defaultValue: "Verified sellers" })}</span>
        </label>
        <label className={optionClass}>
          <input
            type="checkbox"
            checked={values.officialOnly}
            onChange={(event) => onOfficialChange(event.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          <span>{t("search.officialStores", { defaultValue: "Official stores" })}</span>
        </label>

        {facets.brands.length > 0 ? (
          <div className="mt-2 max-h-44 space-y-0.5 overflow-y-auto pr-1">
            <label className={optionClass}>
              <input
                type="radio"
                name={`${idPrefix}-brand`}
                checked={!values.selectedBrand}
                onChange={() => onBrandChange("")}
                className="h-4 w-4 accent-primary"
              />
              <span>{t("search.allBrands", { defaultValue: "All brands" })}</span>
            </label>
            {facets.brands.map((entry) => (
              <label key={entry.key} className={optionClass}>
                <input
                  type="radio"
                  name={`${idPrefix}-brand`}
                  checked={values.selectedBrand === entry.key}
                  onChange={() => onBrandChange(entry.key)}
                  className="h-4 w-4 accent-primary"
                />
                <span className="min-w-0 flex-1 break-words">{entry.key}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{entry.count}</span>
              </label>
            ))}
          </div>
        ) : null}
      </fieldset>
    </div>
  );
}
