/**
 * ProductEditorDrawer sub-component: Media fields.
 * Image removal before save changes form state only (no destructive API call).
 */

import { IconPhoto, IconTrash } from "@tabler/icons-react";
import { useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";


import { ImageWithFallback } from "@/shared/ui";

import type { SellerProductForm } from "../model/product-form";

const MAX_IMAGES = 12;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = /^image\/(jpeg|png|webp)$/;

interface ProductMediaFieldsProps {
  form: UseFormReturn<SellerProductForm>;
  disabled?: boolean;
}

export function ProductMediaFields({ form, disabled }: ProductMediaFieldsProps) {
  const { t } = useTranslation();
  const { watch, setValue, formState: { errors } } = form;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const images = watch("images");
  const imageCount = images?.length ?? 0;

  const enqueueFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const slotsLeft = MAX_IMAGES - imageCount;
    if (slotsLeft <= 0) {
      toast.info(t("seller.products.editor.media.maxReached", { max: MAX_IMAGES }));
      return;
    }
    const toAdd = Array.from(files).slice(0, slotsLeft).filter((file) => {
      if (!ACCEPTED_TYPES.test(file.type)) {
        toast.error(t("seller.products.editor.media.invalidType", { name: file.name }));
        return false;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(
          t("seller.products.editor.media.fileTooLarge", {
            name: file.name,
            maxMb: MAX_IMAGE_BYTES / (1024 * 1024),
          }),
        );
        return false;
      }
      return true;
    });

    if (toAdd.length === 0) return;

    const newEntries = toAdd.map((file) => ({
      url: URL.createObjectURL(file),
      alt: file.name,
      sortOrder: imageCount + toAdd.indexOf(file),
    }));

    // Store blobs as a separate field and keep URLs in form values
    // Note: Blobs are temporary; the real upload flow happens in the drawer mutation.
    // For now we render local blob previews.
    setValue("images", [
      ...(images ?? []),
      ...newEntries.map((e) => ({ url: e.url, alt: e.alt, sortOrder: e.sortOrder })),
    ], { shouldValidate: false });
  };

  const removeImage = (index: number) => {
    const current = images ?? [];
    const removed = current[index];
    if (removed.url.startsWith("blob:")) {
      URL.revokeObjectURL(removed.url);
    }
    setValue(
      "images",
      current.filter((_, i) => i !== index),
      { shouldValidate: false },
    );
  };

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="sr-only">{t("seller.products.editor.media.legend")}</legend>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-semibold text-foreground">
            {t("seller.products.editor.media.label")}
          </label>
          <span className="text-xs text-muted-foreground">
            {imageCount}/{MAX_IMAGES}
          </span>
        </div>

        {/* Image grid */}
        <div className="grid grid-cols-4 gap-3">
          {(images ?? []).map((img, index) => (
            <div
              key={img.url || `image-${index}`}
              className="relative aspect-square rounded-[var(--radius-md)] overflow-hidden bg-muted border border-border"
            >
              <ImageWithFallback
                src={img.url}
                alt={img.alt ?? ""}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(index)}
                disabled={disabled}
                aria-label={t("seller.products.editor.media.remove")}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center hover:bg-card disabled:opacity-50 transition-colors"
              >
                <IconTrash size={12} className="text-error" />
              </button>
            </div>
          ))}

          {imageCount < MAX_IMAGES ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="aspect-square rounded-[var(--radius-md)] border-2 border-dashed border-border flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
            >
              <IconPhoto size={20} aria-hidden="true" />
              <span className="text-[11px] font-medium">
                {t("seller.products.editor.media.add")}
              </span>
            </button>
          ) : null}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            enqueueFiles(e.target.files);
            e.target.value = "";
          }}
        />

        <p className="text-[11px] text-muted-foreground mt-2">
          {t("seller.products.editor.media.hint", {
            maxMb: MAX_IMAGE_BYTES / (1024 * 1024),
            maxCount: MAX_IMAGES,
          })}
        </p>

        {errors.images ? <p className="mt-1 text-xs text-error" role="alert">
            {String(errors.images.message ?? "")}
          </p> : null}
      </div>
    </fieldset>
  );
}
