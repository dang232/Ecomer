import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button, Drawer } from "@/shared/ui";

import { SearchFilters, type SearchFilterValues, type SearchFiltersProps } from "./search-filters";

type DrawerFilterProps = Omit<
  SearchFiltersProps,
  | "idPrefix"
  | "values"
  | "onClear"
  | "onCategoryChange"
  | "onBrandChange"
  | "onPriceMinChange"
  | "onPriceMaxChange"
  | "onApplyPrice"
  | "onRatingChange"
  | "onTagsChange"
  | "onSameDayChange"
  | "onVerifiedChange"
  | "onOfficialChange"
>;

export interface MobileFilterDrawerProps extends DrawerFilterProps {
  open: boolean;
  values: SearchFilterValues;
  onOpenChange: (open: boolean) => void;
  onApply: (values: SearchFilterValues) => void;
}

export function MobileFilterDrawer({
  open,
  values,
  onOpenChange,
  onApply,
  ...filterProps
}: MobileFilterDrawerProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(values);

  useEffect(() => {
    if (open) setDraft(values);
  }, [open, values]);

  const updateDraft = <TKey extends keyof SearchFilterValues>(
    key: TKey,
    value: SearchFilterValues[TKey],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  const clearDraft = () => {
    setDraft({
      selectedCategory: "",
      selectedBrand: "",
      priceMin: "",
      priceMax: "",
      minRating: 0,
      selectedTags: [],
      sameDay: false,
      verifiedOnly: false,
      officialOnly: false,
    });
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={t("search.filtersTitle", { defaultValue: "Filters" })}
      footer={
        <>
          <Button variant="ghost" onClick={clearDraft}>
            {t("search.clearAll", { defaultValue: "Clear all" })}
          </Button>
          <Button
            onClick={() => {
              onApply(draft);
              onOpenChange(false);
            }}
          >
            {t("search.showResults", { defaultValue: "Show results" })}
          </Button>
        </>
      }
    >
      <SearchFilters
        {...filterProps}
        idPrefix="mobile"
        values={draft}
        onClear={clearDraft}
        onCategoryChange={(value) => updateDraft("selectedCategory", value)}
        onBrandChange={(value) => updateDraft("selectedBrand", value)}
        onPriceMinChange={(value) => updateDraft("priceMin", value)}
        onPriceMaxChange={(value) => updateDraft("priceMax", value)}
        onApplyPrice={() => undefined}
        onRatingChange={(value) => updateDraft("minRating", value)}
        onTagsChange={(value) => updateDraft("selectedTags", value)}
        onSameDayChange={(value) => updateDraft("sameDay", value)}
        onVerifiedChange={(value) => updateDraft("verifiedOnly", value)}
        onOfficialChange={(value) => updateDraft("officialOnly", value)}
      />
    </Drawer>
  );
}
