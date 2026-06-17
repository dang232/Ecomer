import { IconPhoto, IconLoader2, IconPlus, IconTrash, IconVideo, IconX as IconXClose } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ApiError } from "../lib/api";
import {
  sellerProductCreate,
  sellerProductImageActivate,
  sellerProductImageUploadUrl,
  sellerProductUpdate,
} from "../lib/api/endpoints/products";
import { videoDelete } from "../lib/api/endpoints/videos";
import type { Product } from "../types/ui";
import { VideoUploadDropzone } from "../../features/videos/components/VideoUploadDropzone";
import { VideoUploadProgress } from "../../features/videos/components/VideoUploadProgress";
import { useProductVideos } from "../../features/videos/hooks/useProductVideos";
import { useVideoUpload } from "../../features/videos/hooks/useVideoUpload";

import { ImageWithFallback } from "./image-with-fallback";
import { ConfirmDialog } from "./ui/confirm-dialog";
import { Modal } from "./ui/modal";

interface SellerProductModalProps {
  open: boolean;
  onClose: () => void;
  /** When provided, the modal opens in edit mode and calls sellerProductUpdate. */
  product?: Product | null;
}

interface StagedFile {
  /** Stable id used as React key — survives re-renders. */
  id: string;
  file: File;
  previewUrl: string;
}

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = /^image\/(jpeg|png|webp)$/;

function parsePriceInput(raw: string): number {
  return Number(raw.replace(/\D/g, "")) || 0;
}

/**
 * Upload a single file via the presigned-URL → S3 PUT → activate flow.
 * Caller must provide a real `productId`.
 */
async function uploadOne(file: File, productId: string): Promise<string> {
  const presigned = await sellerProductImageUploadUrl(productId, {
    contentType: file.type,
    size: file.size,
  });
  const key = presigned.key ?? presigned.uploadUrl.split("?")[0];

  const putRes = await fetch(presigned.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!putRes.ok) {
    // Status code surfaced via i18n in the caller
    throw new Error(`HTTP_${putRes.status}`);
  }

  const activated = await sellerProductImageActivate(productId, { key });
  return activated.url;
}

/**
 * Public wrapper. Renders nothing when closed so the body's state initialisers
 * fire fresh every time the modal opens (taking `product` as the seed). This
 * removes the previous reset-on-open effect.
 */
export function SellerProductModal({ open, onClose, product }: SellerProductModalProps) {
  if (!open) return null;
  return <SellerProductModalBody onClose={onClose} product={product ?? null} />;
}

function SellerProductModalBody({
  onClose,
  product,
}: {
  onClose: () => void;
  product: Product | null;
}) {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEdit = !!product;

  // Form state — initialisers seed from `product` once per mount.
  const [name, setName] = useState(() => product?.name ?? "");
  const [description, setDescription] = useState(() => product?.description ?? "");
  const [price, setPrice] = useState(() => (product?.price ? String(product.price) : ""));
  const [originalPrice, setOriginalPrice] = useState(() =>
    product?.originalPrice ? String(product.originalPrice) : "",
  );
  const [stock, setStock] = useState(() => (product?.stock ? String(product.stock) : "1"));
  const [category, setCategory] = useState(() => product?.category ?? "");

  // Image state. `existingImages` are URLs already attached to the product (edit mode).
  // `staged` are local files the user picked but haven't been uploaded yet.
  const [existingImages, setExistingImages] = useState<string[]>(
    () => product?.images ?? (product?.image ? [product.image] : []),
  );
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [phase, setPhase] = useState<"idle" | "creating" | "uploading" | "finalising">("idle");

  // Video state
  const productId = product?.id ?? null;
  const { videos: existingVideos } = useProductVideos(productId ?? "");
  const videoSlotsFree = 3 - (existingVideos?.length ?? 0);

  const {
    state: videoUploadState,
    upload: startVideoUpload,
    cancel: cancelVideoUpload,
    reset: resetVideoUpload,
    retry: retryVideoUpload,
  } = useVideoUpload({
    entityId: productId ?? "",
    context: "PRODUCT",
    onComplete: () => {
      toast.success(t("video.pipeline.doneTitle"));
      void qc.invalidateQueries({ queryKey: ["videos", "product", productId] });
    },
    onError: (err) => toast.error(err.message),
  });

  const videoUploading = videoUploadState.phase !== "idle" && videoUploadState.phase !== "error";

  // Revoke object URLs on unmount to avoid leaks. Because the wrapper only
  // mounts the body while open, this fires on every close.
  useEffect(() => {
    return () => {
      staged.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalImageCount = existingImages.length + staged.length;
  const isBusy = phase !== "idle";

  // P2-5: Confirm dialog state — replace native window.confirm() prompts.
  const [cancelUploadConfirmOpen, setCancelUploadConfirmOpen] = useState(false);
  const [removeVideoId, setRemoveVideoId] = useState<string | null>(null);

  const handleClose = () => {
    if (isBusy) return;
    if (videoUploading) {
      setCancelUploadConfirmOpen(true);
      return;
    }
    onClose();
  };

  const confirmCancelUpload = () => {
    cancelVideoUpload();
    setCancelUploadConfirmOpen(false);
    onClose();
  };

  /**
   * Single-responsibility delete handler — called from the ConfirmDialog.
   * Kept stable so it can be wired directly to the dialog's onConfirm.
   */
  const handleRemoveVideo = async (videoId: string) => {
    try {
      await videoDelete(videoId);
      void qc.invalidateQueries({ queryKey: ["videos", "product", productId] });
      toast.success(t("seller.productModal.videoDeleted"));
    } catch {
      toast.error(t("seller.productModal.videoDeleteErr"));
    }
  };

  // Modal handles escape + backdrop dismissal; respect dismissDisabled while busy.

  const enqueueFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const slotsLeft = MAX_IMAGES - totalImageCount;
    if (slotsLeft <= 0) {
      toast.info(t("seller.productModal.maxImagesReached", { max: MAX_IMAGES }));
      return;
    }

    const accepted: StagedFile[] = [];
    Array.from(files)
      .slice(0, slotsLeft)
      .forEach((file) => {
        if (!ACCEPTED_TYPES.test(file.type)) {
          toast.error(t("seller.productModal.invalidType", { name: file.name }));
          return;
        }
        if (file.size > MAX_IMAGE_BYTES) {
          toast.error(
            t("seller.productModal.fileTooLarge", {
              name: file.name,
              maxMb: MAX_IMAGE_BYTES / (1024 * 1024),
            }),
          );
          return;
        }
        accepted.push({
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          previewUrl: URL.createObjectURL(file),
        });
      });

    if (accepted.length > 0) setStaged((prev) => [...prev, ...accepted]);
  };

  const removeStaged = (id: string) => {
    setStaged((prev) => {
      const target = prev.find((s) => s.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((s) => s.id !== id);
    });
  };

  const removeExistingImage = (url: string) => {
    setExistingImages((prev) => prev.filter((u) => u !== url));
  };

  /**
   * Save flow:
   *
   *   Edit mode (product exists):
   *     1. Upload all staged files in parallel using product.id.
   *     2. PUT /sellers/me/products/{id} with the merged image list.
   *
   *   Create mode (no product id yet):
   *     1. POST /sellers/me/products with no images (placeholder).
   *     2. Upload all staged files in parallel using the new id.
   *     3. PUT /sellers/me/products/{id} with the image list.
   *
   * Single mutation so the UI stays in sync; per-phase status drives the button label.
   */
  const saveMutation = useMutation({
    mutationFn: async (): Promise<{ id: string; isNew: boolean }> => {
      const priceNum = parsePriceInput(price);
      const originalPriceNum = originalPrice ? parsePriceInput(originalPrice) : undefined;
      const stockNum = parsePriceInput(stock);

      const baseBody = {
        name: name.trim(),
        description: description.trim() || undefined,
        price: priceNum,
        originalPrice: originalPriceNum,
        stock: stockNum,
        category: category.trim() || undefined,
      };

      let productId: string;
      let isNew = false;

      if (isEdit && product) {
        productId = product.id;
      } else {
        setPhase("creating");
        const created = await sellerProductCreate({ ...baseBody, images: [], image: undefined });
        productId = created.id;
        isNew = true;
      }

      let uploadedUrls: string[] = [];
      if (staged.length > 0) {
        setPhase("uploading");
        const settled = await Promise.allSettled(staged.map((s) => uploadOne(s.file, productId)));
        uploadedUrls = settled
          .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
          .map((r) => r.value);
        const failed = settled.filter((r) => r.status === "rejected");
        if (failed.length > 0) {
          // Surface first error but don't abort — partial uploads are still useful.
          const first = failed[0];
          const message =
            first.reason instanceof ApiError
              ? first.reason.message
              : first.reason instanceof Error
                ? first.reason.message
                : t("seller.productModal.someUploadsFailed");
          toast.error(
            t("seller.productModal.uploadPartialFail", {
              failed: failed.length,
              total: staged.length,
              message,
            }),
          );
        }
      }

      const allImages = [...existingImages, ...uploadedUrls];
      // Skip the final PUT when nothing changed in edit mode (no new uploads, no removals).
      const needsFinalUpdate =
        isNew ||
        uploadedUrls.length > 0 ||
        existingImages.length !== (product?.images?.length ?? (product?.image ? 1 : 0)) ||
        baseFieldsChanged(product, baseBody);

      if (needsFinalUpdate) {
        setPhase("finalising");
        await sellerProductUpdate(productId, {
          ...baseBody,
          images: allImages,
          image: allImages[0],
        });
      }

      return { id: productId, isNew };
    },
    onSuccess: ({ id, isNew }) => {
      void qc.invalidateQueries({ queryKey: ["catalog", "products"] });
      void qc.invalidateQueries({ queryKey: ["catalog", "products", "detail", id] });
      toast.success(isNew ? t("seller.productModal.saveOk") : t("seller.productModal.updateOk"));
      onClose();
    },
    onError: (err) =>
      toast.error(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : isEdit
              ? t("seller.productModal.updateErr")
              : t("seller.productModal.saveErr"),
      ),
    onSettled: () => setPhase("idle"),
  });

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error(t("seller.productModal.validationName"));
      return;
    }
    const priceNum = parsePriceInput(price);
    if (priceNum <= 0) {
      toast.error(t("seller.productModal.validationPrice"));
      return;
    }
    if (originalPrice && parsePriceInput(originalPrice) < priceNum) {
      toast.error(t("seller.productModal.validationOriginalPrice"));
      return;
    }
    if (parsePriceInput(stock) < 0) {
      toast.error(t("seller.productModal.validationStock"));
      return;
    }
    saveMutation.mutate();
  };

  if (!open) return null;

  const submitLabel = (() => {
    switch (phase) {
      case "creating":
        return t("seller.productModal.phaseCreating");
      case "uploading":
        return t("seller.productModal.phaseUploading", { count: staged.length });
      case "finalising":
        return t("seller.productModal.phaseFinalising");
      default:
        return isEdit ? t("seller.productModal.save") : t("seller.productModal.publish");
    }
  })();

  return (
    <>
    <Modal
      open
      onClose={handleClose}
      dismissDisabled={isBusy}
      size="lg"
      scrollable
      title={isEdit ? t("seller.productModal.titleEdit") : t("seller.productModal.titleAdd")}
      footer={
        <>
          <button
            type="button"
            onClick={handleClose}
            disabled={isBusy}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground disabled:opacity-50"
          >
            {t("seller.productModal.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isBusy}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #FF6200, #ff8a40)" }}
          >
            {isBusy ? (
              <>
                <IconLoader2 size={14} className="animate-spin" /> {submitLabel}
              </>
            ) : (
              <>
                <IconPlus size={14} /> {submitLabel}
              </>
            )}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">
            {t("seller.productModal.imagesLabel")}{" "}
            <span className="text-muted-foreground font-normal">
              ({totalImageCount}/{MAX_IMAGES})
            </span>
          </label>
          <div className="grid grid-cols-4 gap-3">
            {existingImages.map((url) => (
              <div
                key={url}
                className="relative aspect-square rounded-xl overflow-hidden bg-muted border border-border"
              >
                <ImageWithFallback src={url} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeExistingImage(url)}
                  disabled={isBusy}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center hover:bg-card disabled:opacity-50"
                  aria-label={t("seller.productModal.removeImage")}
                >
                  <IconTrash size={12} className="text-red-500" />
                </button>
              </div>
            ))}
            {staged.map((s) => (
              <div
                key={s.id}
                className="relative aspect-square rounded-xl overflow-hidden bg-muted border border-border"
              >
                <img src={s.previewUrl} alt={s.file.name} className="w-full h-full object-cover" />
                {phase === "uploading" ? (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <IconLoader2 size={20} className="text-white animate-spin" />
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => removeStaged(s.id)}
                  disabled={isBusy}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center hover:bg-card disabled:opacity-50"
                  aria-label={t("seller.productModal.removeImageStaged")}
                >
                  <IconTrash size={12} className="text-red-500" />
                </button>
              </div>
            ))}
            {totalImageCount < MAX_IMAGES ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isBusy}
                className="aspect-square rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors disabled:opacity-50"
              >
                <IconPhoto size={20} />
                <span className="text-[11px] font-medium">{t("seller.productModal.addImage")}</span>
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
            {t("seller.productModal.imageHint", {
              maxMb: MAX_IMAGE_BYTES / (1024 * 1024),
              maxCount: MAX_IMAGES,
            })}
          </p>
        </div>

        {/* ── Video Upload Section ──────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">
            <span className="inline-flex items-center gap-1.5">
              <IconVideo size={15} />
              {t("seller.productModal.videosLabel")}{" "}
              <span className="text-muted-foreground font-normal">
                ({existingVideos.length}/3)
              </span>
            </span>
          </label>

          {/* Existing videos list */}
          {existingVideos.length > 0 && (
            <ul className="space-y-2 mb-3">
              {existingVideos.map((video) => (
                <li
                  key={video.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2"
                >
                  <IconVideo size={16} className="text-muted-foreground shrink-0" />
                  <span className="flex-1 text-xs text-foreground truncate">
                    {video.originalFilename ?? video.id}
                  </span>
                  {/* Status badge — P2-7: map enum to translated label */}
                  <span
                    className={[
                      "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                      video.status === "PUBLISHED"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : video.status === "REJECTED" || video.status === "FAILED"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                    ].join(" ")}
                  >
                    {t(`video.pipeline.${video.status.toLowerCase()}`, {
                      defaultValue: video.status,
                    })}
                  </span>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => setRemoveVideoId(video.id)}
                    aria-label={t("seller.productModal.removeVideo")}
                    className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-surface-elevated text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors shrink-0"
                  >
                    <IconXClose size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Active upload progress */}
          {videoUploadState.videoId && videoUploading && (
            <div className="mb-3 space-y-2">
              <VideoUploadProgress videoId={videoUploadState.videoId} enabled={videoUploading} />
              <button
                type="button"
                onClick={cancelVideoUpload}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors min-h-[44px] min-w-[44px] px-2 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                {t("video.upload.dropzone.cancelAria")}
              </button>
            </div>
          )}

          {/* Dropzone — only shown in edit mode when slots are free and not uploading */}
          {isEdit && videoSlotsFree > 0 && !videoUploading ? (
            <VideoUploadDropzone
              uploadState={videoUploadState}
              onFileSelected={startVideoUpload}
              onCancel={resetVideoUpload}
              disabled={isBusy}
            />
          ) : !isEdit ? (
            <p className="text-[11px] text-muted-foreground">
              {t("seller.productModal.videoCreateHint")}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="seller-product-name"
            className="block text-sm font-semibold text-foreground mb-1.5"
          >
            {t("seller.productModal.nameLabel")}
          </label>
          <input
            id="seller-product-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("seller.productModal.namePlaceholder")}
            className="w-full px-4 py-2.5 border border-border rounded-xl text-sm outline-none focus:border-[var(--primary)]"
            disabled={isBusy}
          />
        </div>

        <div>
          <label
            htmlFor="seller-product-description"
            className="block text-sm font-semibold text-foreground mb-1.5"
          >
            {t("seller.productModal.descriptionLabel")}
          </label>
          <textarea
            id="seller-product-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder={t("seller.productModal.descriptionPlaceholder")}
            className="w-full px-4 py-2.5 border border-border rounded-xl text-sm outline-none focus:border-[var(--primary)] resize-none"
            disabled={isBusy}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="seller-product-price"
              className="block text-sm font-semibold text-foreground mb-1.5"
            >
              {t("seller.productModal.priceLabel")}
            </label>
            <input
              id="seller-product-price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="990000"
              inputMode="numeric"
              className="w-full px-4 py-2.5 border border-border rounded-xl text-sm outline-none focus:border-[var(--primary)]"
              disabled={isBusy}
            />
          </div>
          <div>
            <label
              htmlFor="seller-product-original-price"
              className="block text-sm font-semibold text-foreground mb-1.5"
            >
              {t("seller.productModal.originalPriceLabel")}
            </label>
            <input
              id="seller-product-original-price"
              value={originalPrice}
              onChange={(e) => setOriginalPrice(e.target.value)}
              placeholder="1290000"
              inputMode="numeric"
              className="w-full px-4 py-2.5 border border-border rounded-xl text-sm outline-none focus:border-[var(--primary)]"
              disabled={isBusy}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="seller-product-stock"
              className="block text-sm font-semibold text-foreground mb-1.5"
            >
              {t("seller.productModal.stockLabel")}
            </label>
            <input
              id="seller-product-stock"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="100"
              inputMode="numeric"
              className="w-full px-4 py-2.5 border border-border rounded-xl text-sm outline-none focus:border-[var(--primary)]"
              disabled={isBusy}
            />
          </div>
          <div>
            <label
              htmlFor="seller-product-category"
              className="block text-sm font-semibold text-foreground mb-1.5"
            >
              {t("seller.productModal.categoryLabel")}
            </label>
            <input
              id="seller-product-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="electronics"
              className="w-full px-4 py-2.5 border border-border rounded-xl text-sm outline-none focus:border-[var(--primary)]"
              disabled={isBusy}
            />
          </div>
        </div>
      </div>

      {/* P2-5: replaces window.confirm() at the upload-cancel exit path. */}
      <ConfirmDialog
        open={cancelUploadConfirmOpen}
        onClose={() => setCancelUploadConfirmOpen(false)}
        onConfirm={confirmCancelUpload}
        title={t("video.seller.cancelUpload")}
        description={t("video.upload.cancelConfirm")}
        confirmLabel={t("common.confirm")}
        cancelLabel={t("common.cancel")}
      />

      {/* P2-5: destructive confirm for the per-row "Remove video" action. */}
      <ConfirmDialog
        open={removeVideoId !== null}
        onClose={() => setRemoveVideoId(null)}
        onConfirm={() => {
          if (removeVideoId) void handleRemoveVideo(removeVideoId);
          setRemoveVideoId(null);
        }}
        title={t("seller.productModal.removeVideoTitle")}
        description={t("seller.productModal.removeVideoDescription")}
        confirmLabel={t("seller.productModal.removeVideo")}
        cancelLabel={t("common.cancel")}
        variant="danger"
      />
    </Modal>
    </>
  );
}

function baseFieldsChanged(
  product: Product | null | undefined,
  body: {
    name: string;
    description: string | undefined;
    price: number;
    originalPrice: number | undefined;
    stock: number;
    category: string | undefined;
  },
): boolean {
  if (!product) return true;
  return (
    product.name !== body.name ||
    (product.description ?? "") !== (body.description ?? "") ||
    product.price !== body.price ||
    (product.originalPrice ?? undefined) !== body.originalPrice ||
    product.stock !== body.stock ||
    (product.category ?? undefined) !== body.category
  );
}
