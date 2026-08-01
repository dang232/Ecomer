/**
 * ProductEditorDrawer — four-section drawer for product create/edit.
 *
 * - Sticky footer with Cancel + Save.
 * - On close with isDirty: AlertDialog (Discard / Continue editing).
 * - Creation flow: save → POST → DRAFT returned → persist to sessionStorage → show
 *   publication recovery surface (Publish / Continue editing / Delete draft).
 * - Edit flow: save → PUT → done.
 *
 * Image removal before save is form-state-only; destructive activation/replacement
 * calls require confirmation (handled in the mutation layer).
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
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

import { clearDraftRecovery, getDraftRecovery, saveDraftRecovery } from "../model/draft-recovery";
import { sellerProductFormSchema, toSellerProductWriteBody } from "../model/product-form";
import type { SellerProductForm } from "../model/product-form";

import { ProductBasicFields } from "./product-basic-fields";
import { ProductMediaFields } from "./product-media-fields";
import { ProductPublication } from "./product-publication";
import { ProductVariantFields } from "./product-variant-fields";

// ── Props ───────────────────────────────────────────────────────────────────────

export interface ProductEditorDrawerProps {
  open: boolean;
  /** When provided, the drawer opens in edit mode. */
  product: { id: string } | null;
  onClose: () => void;
  /** Called after a successful save. Callers should invalidate list queries. */
  onSave: (values: SellerProductForm) => Promise<void>;
}

// ── Image upload helper ────────────────────────────────────────────────────────

async function _uploadImage(productId: string, file: File): Promise<string> {
  const { sellerProductImageUploadUrl, sellerProductImageActivate } =
    await import("@/shared/api/endpoints/products");
  const presigned = await sellerProductImageUploadUrl(productId, {
    contentType: file.type,
    size: file.size,
  });
  const key = presigned.key ?? presigned.uploadUrl.split("?")[0];
  const putRes = await fetch(presigned.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
    signal: AbortSignal.timeout(30_000),
  });
  if (!putRes.ok) throw new Error(`HTTP_${putRes.status}`);
  const activated = await sellerProductImageActivate(productId, { key });
  return activated.url;
}

// ── Drawer ─────────────────────────────────────────────────────────────────────

export function ProductEditorDrawer({ open, product, onClose, onSave }: ProductEditorDrawerProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const isEdit = !!product;

  // Draft recovery: check on mount if we're recovering a draft.
  const [recoveredDraft, setRecoveredDraft] = useState<{
    productId: string;
    formValues: SellerProductForm;
  } | null>(null);

  const form = useForm<SellerProductForm>({
    resolver: zodResolver(sellerProductFormSchema),
    defaultValues: {
      name: "",
      description: "",
      categoryId: "",
      brand: "",
      tags: [],
      images: [],
      variants: [{ sku: "", name: "", priceAmount: 0, stockQuantity: 0 }],
    },
    mode: "onTouched",
  });

  const { reset, formState } = form;
  const isDirty = formState.isDirty;

  // Check for draft recovery on open.
  useEffect(() => {
    if (open && !isEdit) {
      const draft = getDraftRecovery();
      if (draft) {
        setRecoveredDraft(draft);
        reset(draft.formValues);
      } else {
        setRecoveredDraft(null);
        reset({
          name: "",
          description: "",
          categoryId: "",
          brand: "",
          tags: [],
          images: [],
          variants: [{ sku: "", name: "", priceAmount: 0, stockQuantity: 0 }],
        });
      }
    }
  }, [open, isEdit, reset]);

  // ── Mutations ───────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (body: SellerProductWriteBody) => {
      const result = await sellerProductCreate(body);
      return result;
    },
    onSuccess: async (result) => {
      // Persist to sessionStorage for recovery.
      saveDraftRecovery(result.id, form.getValues());

      // Notify caller (invalidates queries, etc.)
      await onSave(form.getValues());

      // Transition to "draft saved — awaiting publication" state.
      setRecoveredDraft({ productId: result.id, formValues: form.getValues() });

      toast.success(t("seller.products.editor.saveOk"));
      await qc.invalidateQueries({ queryKey: ["catalog", "products"] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : t("seller.products.editor.saveErr"));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (body: SellerProductWriteBody) => {
      if (!product) throw new Error("No product id");
      return sellerProductUpdate(product.id, body);
    },
    onSuccess: async () => {
      await onSave(form.getValues());
      toast.success(t("seller.products.editor.updateOk"));
      await qc.invalidateQueries({ queryKey: ["catalog", "products"] });
      onClose();
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : t("seller.products.editor.updateErr"));
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (id: string) => {
      await sellerProductPublish(id);
      return id;
    },
    onSuccess: async (_id: string) => {
      clearDraftRecovery();
      setRecoveredDraft(null);
      toast.success(t("seller.products.editor.publishOk"));
      await qc.invalidateQueries({ queryKey: ["catalog", "products"] });
      onClose();
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : t("seller.products.editor.publishErr"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await sellerProductDelete(id);
      return id;
    },
    onSuccess: async () => {
      clearDraftRecovery();
      setRecoveredDraft(null);
      toast.success(t("seller.products.editor.deleteOk"));
      await qc.invalidateQueries({ queryKey: ["catalog", "products"] });
      onClose();
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : t("seller.products.editor.deleteErr"));
    },
  });

  // ── Submit handler ──────────────────────────────────────────────────────────

  const handleSave = (values: SellerProductForm) => {
    if (createMutation.isPending || updateMutation.isPending) return;
    const body = toSellerProductWriteBody(values);
    if (isEdit) {
      updateMutation.mutate(body);
    } else {
      createMutation.mutate(body);
    }
  };

  const isBusy =
    createMutation.isPending ||
    updateMutation.isPending ||
    publishMutation.isPending ||
    deleteMutation.isPending;

  // ── Discard dialog state ────────────────────────────────────────────────────

  const [discardOpen, setDiscardOpen] = useState(false);

  const handleClose = () => {
    if (isBusy) return;
    if (isDirty) {
      setDiscardOpen(true);
    } else {
      onClose();
    }
  };

  const handleDiscardConfirm = () => {
    setDiscardOpen(false);
    onClose();
  };

  // ── Draft recovery: publish ─────────────────────────────────────────────────

  const handlePublish = () => {
    if (!recoveredDraft) return;
    publishMutation.mutate(recoveredDraft.productId);
  };

  // ── Draft recovery: continue editing ───────────────────────────────────────

  const handleContinueEditing = () => {
    // Keep editor open; recovery stays in sessionStorage.
    setRecoveredDraft(null);
  };

  // ── Draft recovery: delete ───────────────────────────────────────────────────

  const handleDelete = () => {
    if (!recoveredDraft) return;
    deleteMutation.mutate(recoveredDraft.productId);
  };

  // ── Footer ──────────────────────────────────────────────────────────────────

  const footer = (
    <>
      <Button variant="outline" onClick={handleClose} disabled={isBusy}>
        {t("seller.products.editor.cancel")}
      </Button>
      {!isEdit && !recoveredDraft ? (
        <Button
          variant="primary"
          onClick={form.handleSubmit(handleSave)}
          disabled={isBusy}
          pending={createMutation.isPending}
          pendingLabel={t("seller.products.editor.saving")}
        >
          {t("seller.products.editor.saveDraft")}
        </Button>
      ) : null}
      {recoveredDraft ? (
        <Button
          variant="accent"
          onClick={form.handleSubmit(handleSave)}
          disabled={isBusy}
          pending={updateMutation.isPending}
          pendingLabel={t("seller.products.editor.saving")}
        >
          {t("seller.products.editor.updateDraft")}
        </Button>
      ) : null}
      {isEdit ? (
        <Button
          variant="primary"
          onClick={form.handleSubmit(handleSave)}
          disabled={isBusy}
          pending={updateMutation.isPending}
          pendingLabel={t("seller.products.editor.saving")}
        >
          {t("seller.products.editor.save")}
        </Button>
      ) : null}
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
        onOpenChange={(next) => {
          if (!next) handleClose();
        }}
      >
        <div className="space-y-6">
          {/* Basic */}
          <section aria-labelledby="basic-heading">
            <h3
              id="basic-heading"
              className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide"
            >
              {t("seller.products.editor.sectionBasic")}
            </h3>
            <ProductBasicFields
              register={form.register}
              errors={form.formState.errors}
              disabled={isBusy}
            />
          </section>

          {/* Media */}
          <section aria-labelledby="media-heading">
            <h3
              id="media-heading"
              className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide"
            >
              {t("seller.products.editor.sectionMedia")}
            </h3>
            <ProductMediaFields form={form} disabled={isBusy} />
          </section>

          {/* Variants */}
          <section aria-labelledby="variants-heading">
            <h3
              id="variants-heading"
              className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide"
            >
              {t("seller.products.editor.sectionVariants")}
            </h3>
            <ProductVariantFields form={form} disabled={isBusy} />
          </section>

          {/* Publication — only shown for recovered drafts */}
          {recoveredDraft ? (
            <section aria-labelledby="publication-heading">
              <h3
                id="publication-heading"
                className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide"
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
      </Drawer>

      {/* Sticky footer rendered outside drawer scroll area */}
      {open ? (
        <div
          className="fixed bottom-0 right-0 z-[60] w-full max-w-[min(100vw,36rem)] border-t border-border bg-card px-5 py-4 sm:px-6 flex flex-wrap items-center justify-end gap-3"
          style={{ maxWidth: "min(100vw, 36rem)" }}
        >
          {footer}
        </div>
      ) : null}

      {/* Discard confirmation */}
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
