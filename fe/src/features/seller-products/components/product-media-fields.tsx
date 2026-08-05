/**
 * ProductEditorDrawer sub-component: product media.
 *
 * Saved URLs and local files are separate data types. A local preview is never
 * placed in the product write body, so a browser-only blob URL cannot leak into
 * catalog data.
 */

import { Trash2, Upload } from "lucide-react";
import { useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ImageWithFallback } from "@/shared/ui";

import type { SellerProductForm } from "../model/product-form";
import type { PendingProductImage } from "../model/product-image-upload";

const MAX_IMAGES = 10;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = /^image\/(jpeg|png|webp)$/;

interface ProductMediaFieldsProps {
  form: UseFormReturn<SellerProductForm>;
  pendingImages: readonly PendingProductImage[];
  onPendingImagesChange: (images: PendingProductImage[]) => void;
  disabled?: boolean;
}

export function ProductMediaFields({
  form,
  pendingImages,
  onPendingImagesChange,
  disabled,
}: ProductMediaFieldsProps) {
  const { t } = useTranslation();
  const {
    watch,
    setValue,
    formState: { errors },
  } = form;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const images = watch("images") ?? [];
  const imageCount = images.length + pendingImages.length;

  const markImagesDirty = () => {
    setValue("images", images, { shouldDirty: true, shouldTouch: true, shouldValidate: false });
  };

  const enqueueFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const slotsLeft = MAX_IMAGES - imageCount;
    if (slotsLeft <= 0) {
      toast.info(t("seller.products.editor.media.maxReached", { max: MAX_IMAGES }));
      return;
    }

    const acceptedFiles = Array.from(files)
      .slice(0, slotsLeft)
      .filter((file) => {
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

    if (acceptedFiles.length === 0) return;
    const newImages = acceptedFiles.map((file, index) => ({
      id: makeImageId(),
      file,
      previewUrl: URL.createObjectURL(file),
      alt: file.name,
      sortOrder: imageCount + index,
    }));
    onPendingImagesChange([...pendingImages, ...newImages]);
    markImagesDirty();
  };

  const removePersistedImage = (index: number) => {
    setValue(
      "images",
      images.filter((_, imageIndex) => imageIndex !== index),
      { shouldDirty: true, shouldTouch: true, shouldValidate: false },
    );
  };

  const removePendingImage = (id: string) => {
    onPendingImagesChange(pendingImages.filter((image) => image.id !== id));
    markImagesDirty();
  };

  return (
    <fieldset
      className="space-y-3"
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
    >
      <legend className="sr-only">{t("seller.products.editor.media.legend")}</legend>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <label className="block text-sm font-semibold text-foreground">
              {t("seller.products.editor.media.label")}
            </label>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("seller.products.editor.media.hint", {
                maxMb: MAX_IMAGE_BYTES / (1024 * 1024),
                maxCount: MAX_IMAGES,
              })}
            </p>
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            {t("seller.products.editor.media.count", { count: imageCount, max: MAX_IMAGES })}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((image, index) => (
            <MediaTile
              key={image.url || `saved-image-${index}`}
              src={image.url}
              alt={image.alt ?? ""}
              badge={t("seller.products.editor.media.saved")}
              removeLabel={t("seller.products.editor.media.remove")}
              onRemove={() => removePersistedImage(index)}
              disabled={disabled}
            />
          ))}
          {pendingImages.map((image) => (
            <MediaTile
              key={image.id}
              src={image.previewUrl}
              alt={image.alt}
              badge={t("seller.products.editor.media.pending")}
              removeLabel={t("seller.products.editor.media.remove")}
              onRemove={() => removePendingImage(image.id)}
              disabled={disabled}
            />
          ))}

          {imageCount < MAX_IMAGES ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="aspect-square rounded-[var(--radius-md)] border-2 border-dashed border-border px-3 text-center text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
            >
              <span className="flex flex-col items-center justify-center gap-1.5">
                <Upload size={20} aria-hidden="true" />
                <span className="text-xs font-semibold">
                  {t("seller.products.editor.media.add")}
                </span>
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
          onChange={(event) => {
            enqueueFiles(event.target.files);
            event.target.value = "";
          }}
        />

        {pendingImages.length > 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("seller.products.editor.media.pendingHint")}
          </p>
        ) : null}

        {errors.images ? (
          <p className="mt-1 text-xs text-error" role="alert">
            {String(errors.images.message ?? "")}
          </p>
        ) : null}
      </div>
    </fieldset>
  );
}

function MediaTile({
  src,
  alt,
  badge,
  removeLabel,
  onRemove,
  disabled,
}: {
  src: string;
  alt: string;
  badge: string;
  removeLabel: string;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-[var(--radius-md)] border border-border bg-muted">
      <ImageWithFallback src={src} alt={alt} className="h-full w-full object-cover" />
      <span className="absolute bottom-1 left-1 max-w-[calc(100%-2.5rem)] truncate rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white">
        {badge}
      </span>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={removeLabel}
        className="absolute right-1 top-1 inline-flex min-h-8 min-w-8 items-center justify-center rounded-full bg-white/90 text-error transition-colors hover:bg-card disabled:opacity-50"
      >
        <Trash2 size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

function makeImageId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `image-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
