/**
 * ProductEditorDrawer sub-component: Publication section.
 * Shown only after a draft has been created (create flow).
 * Surface: Publish, Continue editing, Delete draft.
 */

import { Rocket, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/shared/ui";

interface ProductPublicationProps {
  productId: string;
  onPublish: () => void;
  onDelete: () => void;
  onContinueEditing: () => void;
  publishPending?: boolean;
  deletePending?: boolean;
  disabled?: boolean;
}

export function ProductPublication({
  productId,
  onPublish,
  onDelete,
  onContinueEditing,
  publishPending = false,
  deletePending = false,
  disabled = false,
}: ProductPublicationProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4" data-testid="publication">
      <div className="rounded-[var(--radius-md)] border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground mb-1">
          {t("seller.products.editor.publication.draftNotice")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("seller.products.editor.publication.draftHint", { id: productId.slice(0, 8) })}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Button
          variant="primary"
          onClick={onPublish}
          disabled={disabled || publishPending}
          pending={publishPending}
          pendingLabel={t("seller.products.editor.publication.publishing")}
          className="w-full justify-center"
        >
          <Rocket size={16} aria-hidden="true" />
          {t("seller.products.editor.publication.publish")}
        </Button>

        <Button
          variant="outline"
          onClick={onContinueEditing}
          disabled={disabled}
          className="w-full justify-center"
        >
          <Pencil size={16} aria-hidden="true" />
          {t("seller.products.editor.publication.continueEditing")}
        </Button>

        <Button
          variant="ghost"
          onClick={onDelete}
          disabled={disabled || deletePending}
          pending={deletePending}
          pendingLabel={t("seller.products.editor.publication.deleting")}
          className="w-full justify-center text-error hover:bg-error-light"
        >
          <Trash2 size={16} aria-hidden="true" />
          {t("seller.products.editor.publication.deleteDraft")}
        </Button>
      </div>
    </div>
  );
}
