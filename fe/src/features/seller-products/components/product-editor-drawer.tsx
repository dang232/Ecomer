/**
 * Product editor for creating and updating seller catalog records.
 *
 * The form owns product fields. Local image files live in a separate state
 * collection and are uploaded only after a product ID exists.
 */

import { toNestErrors } from "@hookform/resolvers";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm, type FieldError, type FieldErrors, type Resolver } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ApiError } from "@/shared/api";
import {
  sellerProductCreate,
  sellerProductDelete,
  sellerProductPublish,
  sellerProductUpdate,
} from "@/shared/api/endpoints/products";
import type { SellerProductWriteBody } from "@/shared/api/endpoints/products";
import { AlertDialog, Button, Drawer } from "@/shared/ui";

import { sellerProductCategoriesOptions, sellerProductDetailOptions } from "../api/query-options";
import { clearDraftRecovery, getDraftRecovery, saveDraftRecovery } from "../model/draft-recovery";
import {
  emptySellerProductForm,
  fromSellerProduct,
  sellerProductFormSchema,
  toSellerProductWriteBody,
} from "../model/product-form";
import type { SellerProductForm } from "../model/product-form";
import { type PendingProductImage, uploadProductImages } from "../model/product-image-upload";

import { ProductBasicFields } from "./product-basic-fields";
import { ProductMediaFields } from "./product-media-fields";
import { ProductPublication } from "./product-publication";
import { ProductVariantFields } from "./product-variant-fields";
import { ProductVideoFields } from "./product-video-fields";

export interface ProductEditorDrawerProps {
  open: boolean;
  /** When provided, the drawer opens in edit mode. */
  product: { id: string } | null;
  onClose: () => void;
  /** Called after a successful save. Callers should invalidate list queries. */
  onSave: (values: SellerProductForm) => Promise<void>;
}

const sellerProductResolver: Resolver<SellerProductForm> = async (values, _, options) => {
  const result = await sellerProductFormSchema.safeParseAsync(values);
  if (result.success) return { values: result.data, errors: {} };

  const flatErrors = result.error.issues.reduce<Record<string, FieldError>>((errors, issue) => {
    const path = issue.path.join(".");
    if (!errors[path]) errors[path] = { type: issue.code, message: issue.message };
    return errors;
  }, {});
  return { values: {}, errors: toNestErrors(flatErrors, options) };
};

interface SaveInput {
  values: SellerProductForm;
  body: SellerProductWriteBody;
  pendingImages: readonly PendingProductImage[];
}

interface UpdateInput extends SaveInput {
  productId: string;
  keepDraftOpen: boolean;
}

interface SaveResult {
  result: Awaited<ReturnType<typeof sellerProductCreate>>;
  values: SellerProductForm;
}

class DraftMediaSaveError extends Error {
  constructor(
    readonly productId: string,
    readonly values: SellerProductForm,
    cause: unknown,
  ) {
    super("draft_media_save_failed", { cause });
    this.name = "DraftMediaSaveError";
  }
}

async function attachPendingImages(
  productId: string,
  values: SellerProductForm,
  pendingImages: readonly PendingProductImage[],
): Promise<SellerProductForm> {
  if (pendingImages.length === 0) return values;
  const uploaded = await uploadProductImages(productId, pendingImages);
  return {
    ...values,
    images: [...values.images, ...uploaded].map((image, index) => ({
      ...image,
      sortOrder: index,
    })),
  };
}

export function ProductEditorDrawer({ open, product, onClose, onSave }: ProductEditorDrawerProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isEdit = product !== null;
  const categoriesQuery = useQuery(sellerProductCategoriesOptions());
  const productDetailQuery = useQuery({
    ...sellerProductDetailOptions(product?.id ?? ""),
    enabled: open && isEdit && Boolean(product?.id),
  });

  const [recoveredDraft, setRecoveredDraft] = useState<{
    productId: string;
    formValues: SellerProductForm;
  } | null>(null);
  const [pendingImages, setPendingImages] = useState<PendingProductImage[]>([]);
  const [pendingVideo, setPendingVideo] = useState<File | null>(null);
  const [validationFeedback, setValidationFeedback] = useState(false);
  const pendingImagesRef = useRef<PendingProductImage[]>([]);

  const updatePendingImages = useCallback((nextImages: PendingProductImage[]) => {
    setPendingImages((previousImages) => {
      const nextIds = new Set(nextImages.map((image) => image.id));
      previousImages.forEach((image) => {
        if (!nextIds.has(image.id)) URL.revokeObjectURL(image.previewUrl);
      });
      return nextImages;
    });
  }, []);

  const clearPendingImages = useCallback(() => updatePendingImages([]), [updatePendingImages]);

  useEffect(() => {
    pendingImagesRef.current = pendingImages;
  }, [pendingImages]);

  useEffect(
    () => () => {
      pendingImagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    },
    [],
  );

  const form = useForm<SellerProductForm>({
    resolver: sellerProductResolver,
    defaultValues: emptySellerProductForm(),
    mode: "onTouched",
  });
  const { reset, formState } = form;
  const isDirty = formState.isDirty;

  useEffect(() => {
    if (!open) return;
    clearPendingImages();
    setPendingVideo(null);
    if (isEdit) {
      setRecoveredDraft(null);
      return;
    }

    const draft = getDraftRecovery();
    if (draft) {
      setRecoveredDraft(draft);
      reset(draft.formValues);
    } else {
      setRecoveredDraft(null);
      reset(emptySellerProductForm());
    }
  }, [clearPendingImages, isEdit, open, product?.id, reset]);

  useEffect(() => {
    if (!open || !isEdit || !productDetailQuery.data) return;
    clearPendingImages();
    setPendingVideo(null);
    setRecoveredDraft(null);
    reset(fromSellerProduct(productDetailQuery.data));
  }, [clearPendingImages, isEdit, open, productDetailQuery.data, reset]);

  const invalidateProductQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["catalog", "products"] }),
      queryClient.invalidateQueries({ queryKey: ["seller", "products"] }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: async (input: SaveInput): Promise<SaveResult> => {
      const created = await sellerProductCreate(input.body);
      try {
        const values = await attachPendingImages(created.id, input.values, input.pendingImages);
        if (input.pendingImages.length > 0) {
          const updated = await sellerProductUpdate(created.id, toSellerProductWriteBody(values));
          return { result: updated, values };
        }
        return { result: created, values };
      } catch (error) {
        // Product creation completed before direct-to-storage upload. Keep the
        // server draft recoverable so a transient media failure never forces a
        // seller to re-enter the product data or create duplicate drafts.
        throw new DraftMediaSaveError(created.id, input.values, error);
      }
    },
    onSuccess: async ({ result, values }) => {
      reset(values);
      clearPendingImages();
      saveDraftRecovery(result.id, values);
      await onSave(values);
      setRecoveredDraft({ productId: result.id, formValues: values });
      toast.success(t("seller.products.editor.saveOk"));
      await invalidateProductQueries();
    },
    onError: (error) => {
      if (error instanceof DraftMediaSaveError) {
        reset(error.values);
        saveDraftRecovery(error.productId, error.values);
        setRecoveredDraft({ productId: error.productId, formValues: error.values });
        toast.error(t("seller.products.editor.savePartialErr"));
        void invalidateProductQueries();
        return;
      }
      toast.error(error instanceof ApiError ? error.message : t("seller.products.editor.saveErr"));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (input: UpdateInput): Promise<SaveResult> => {
      const values = await attachPendingImages(input.productId, input.values, input.pendingImages);
      const result = await sellerProductUpdate(input.productId, toSellerProductWriteBody(values));
      return { result, values };
    },
    onSuccess: async ({ values }, input) => {
      reset(values);
      clearPendingImages();
      if (input.keepDraftOpen) {
        saveDraftRecovery(input.productId, values);
        setRecoveredDraft({ productId: input.productId, formValues: values });
        toast.success(t("seller.products.editor.updateOk"));
        await invalidateProductQueries();
        return;
      }
      await onSave(values);
      toast.success(t("seller.products.editor.updateOk"));
      await invalidateProductQueries();
      onClose();
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError ? error.message : t("seller.products.editor.updateErr"),
      );
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (id: string) => {
      await sellerProductPublish(id);
      return id;
    },
    onSuccess: async () => {
      clearDraftRecovery();
      clearPendingImages();
      setRecoveredDraft(null);
      toast.success(t("seller.products.editor.publishOk"));
      await invalidateProductQueries();
      onClose();
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError ? error.message : t("seller.products.editor.publishErr"),
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await sellerProductDelete(id);
      return id;
    },
    onSuccess: async () => {
      clearDraftRecovery();
      clearPendingImages();
      setRecoveredDraft(null);
      toast.success(t("seller.products.editor.deleteOk"));
      await invalidateProductQueries();
      onClose();
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError ? error.message : t("seller.products.editor.deleteErr"),
      );
    },
  });

  const handleSave = (values: SellerProductForm) => {
    if (createMutation.isPending || updateMutation.isPending) return;
    const body = toSellerProductWriteBody(values);
    const images = [...pendingImages];
    const existingProductId = recoveredDraft?.productId ?? product?.id;
    if (existingProductId) {
      updateMutation.mutate({
        productId: existingProductId,
        values,
        body,
        pendingImages: images,
        keepDraftOpen: Boolean(recoveredDraft),
      });
      return;
    }
    createMutation.mutate({ values, body, pendingImages: images });
  };

  const handleInvalidSave = (errors: FieldErrors<SellerProductForm>) => {
    setValidationFeedback(true);
    const firstInvalidField = Object.keys(errors)[0] as keyof SellerProductForm | undefined;
    if (firstInvalidField) void form.setFocus(firstInvalidField);
    toast.error(t("seller.products.editor.validationErr"));
  };

  const isBusy =
    createMutation.isPending ||
    updateMutation.isPending ||
    publishMutation.isPending ||
    deleteMutation.isPending;
  const isExistingProduct = isEdit || recoveredDraft !== null;
  const persistedProductId = recoveredDraft?.productId ?? product?.id ?? null;
  const editorLoading = isEdit && productDetailQuery.isPending;
  const editorError = isEdit && productDetailQuery.isError;
  const [discardOpen, setDiscardOpen] = useState(false);

  const handleClose = () => {
    if (isBusy) return;
    if (isDirty) {
      setDiscardOpen(true);
    } else {
      clearPendingImages();
      onClose();
    }
  };

  const handleDiscardConfirm = () => {
    setDiscardOpen(false);
    clearPendingImages();
    onClose();
  };

  const handlePublish = () => {
    if (recoveredDraft) publishMutation.mutate(recoveredDraft.productId);
  };

  const handleDelete = () => {
    if (recoveredDraft) deleteMutation.mutate(recoveredDraft.productId);
  };

  const handleContinueEditing = () => setRecoveredDraft(null);

  const handleVideoFileSelected = (file: File) => setPendingVideo(file);

  const savePending = isExistingProduct ? updateMutation.isPending : createMutation.isPending;
  const saveLabel = recoveredDraft
    ? t("seller.products.editor.updateDraft")
    : isEdit
      ? t("seller.products.editor.save")
      : t("seller.products.editor.saveDraft");
  const footer = (
    <>
      {validationFeedback ? (
        <p role="alert" className="w-full text-sm text-destructive">
          {t("seller.products.editor.validationErr")}
        </p>
      ) : null}
      <Button variant="outline" onClick={handleClose} disabled={isBusy}>
        {t("seller.products.editor.cancel")}
      </Button>
      <Button
        variant="primary"
        onClick={form.handleSubmit(handleSave, handleInvalidSave)}
        disabled={isBusy || editorLoading || editorError}
        pending={savePending}
        pendingLabel={t("seller.products.editor.saving")}
      >
        {saveLabel}
      </Button>
    </>
  );

  return (
    <>
      <Drawer
        open={open}
        title={
          isEdit
            ? t("seller.products.editor.titleEdit")
            : recoveredDraft
              ? t("seller.products.editor.titleDraft")
              : t("seller.products.editor.titleNew")
        }
        description={t("seller.products.editor.description")}
        footer={footer}
        showCloseButton={false}
        onOpenChange={(next) => {
          if (!next) handleClose();
        }}
      >
        {editorLoading ? (
          <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
            {t("seller.products.editor.loading")}
          </div>
        ) : editorError ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm font-medium text-foreground">
              {t("seller.products.editor.loadError")}
            </p>
            <Button variant="outline" size="sm" onClick={() => productDetailQuery.refetch()}>
              {t("seller.products.editor.retry")}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <section aria-labelledby="basic-heading">
              <h3
                id="basic-heading"
                className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground"
              >
                {t("seller.products.editor.sectionBasic")}
              </h3>
              <ProductBasicFields
                register={form.register}
                control={form.control}
                errors={form.formState.errors}
                categories={categoriesQuery.data ?? []}
                categoriesLoading={categoriesQuery.isLoading}
                categoriesError={categoriesQuery.isError}
                disabled={isBusy}
              />
            </section>

            <section aria-labelledby="media-heading">
              <h3
                id="media-heading"
                className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground"
              >
                {t("seller.products.editor.sectionMedia")}
              </h3>
              <ProductMediaFields
                form={form}
                pendingImages={pendingImages}
                onPendingImagesChange={updatePendingImages}
                disabled={isBusy}
              />
              {persistedProductId ? (
                <ProductVideoFields
                  productId={persistedProductId}
                  disabled={isBusy}
                  initialFile={pendingVideo}
                  onInitialFileConsumed={() => setPendingVideo(null)}
                />
              ) : (
                <ProductVideoCreateField
                  disabled={isBusy}
                  onFileSelected={handleVideoFileSelected}
                  selectedFile={pendingVideo}
                />
              )}
            </section>

            <section aria-labelledby="variants-heading">
              <h3
                id="variants-heading"
                className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground"
              >
                {t("seller.products.editor.sectionVariants")}
              </h3>
              <ProductVariantFields form={form} disabled={isBusy} />
            </section>

            {recoveredDraft ? (
              <section aria-labelledby="publication-heading">
                <h3
                  id="publication-heading"
                  className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground"
                >
                  {t("seller.products.editor.sectionPublication")}
                </h3>
                <ProductPublication
                  productId={recoveredDraft.productId}
                  onPublish={handlePublish}
                  onDelete={handleDelete}
                  onContinueEditing={handleContinueEditing}
                  publishPending={publishMutation.isPending}
                  deletePending={deleteMutation.isPending}
                  disabled={isBusy}
                />
              </section>
            ) : null}
          </div>
        )}
      </Drawer>

      <AlertDialog
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        onConfirm={handleDiscardConfirm}
        title={t("seller.products.editor.discardTitle")}
        description={t("seller.products.editor.discardDescription")}
        confirmLabel={t("seller.products.editor.discard")}
        cancelLabel={t("seller.products.editor.continueEditing")}
        variant="danger"
      />
    </>
  );
}

function ProductVideoCreateField({
  disabled,
  onFileSelected,
  selectedFile,
}: {
  disabled: boolean;
  onFileSelected: (file: File) => void;
  selectedFile: File | null;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <fieldset className="space-y-2 border-t border-border pt-4" disabled={disabled}>
      <legend className="sr-only">{t("video.seller.sectionTitle", { count: 0, max: 3 })}</legend>
      <p className="text-sm font-semibold text-foreground">
        {t("video.seller.sectionTitle", { count: 0, max: 3 })}
      </p>
      <p className="text-xs text-muted-foreground">{t("seller.products.editor.videoCreateHint")}</p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="rounded-[var(--radius-md)] border border-dashed border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary"
      >
        {selectedFile ? selectedFile.name : t("video.upload.dropzone.title")}
      </button>
      <input
        ref={inputRef}
        aria-label={t("video.seller.sectionTitle", { count: 0, max: 3 })}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFileSelected(file);
          event.target.value = "";
        }}
      />
    </fieldset>
  );
}
