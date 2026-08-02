import { useTranslation } from "react-i18next";

import {
  VideoUploadDropzone,
  VideoUploadProgress,
  useProductVideos,
  useVideoUpload,
} from "@/features/videos";

interface ProductVideoFieldsProps {
  productId: string;
  disabled?: boolean;
}

export function ProductVideoFields({ productId, disabled = false }: ProductVideoFieldsProps) {
  const { t } = useTranslation();
  const { state, upload, cancel, retry } = useVideoUpload({
    entityId: productId,
    context: "PRODUCT",
  });
  const productVideos = useProductVideos(productId);
  const statusVideoId = state.videoId ?? productVideos.videos[0]?.id ?? null;
  const videoCount = statusVideoId ? 1 : 0;

  return (
    <fieldset
      className="space-y-3 border-t border-border pt-4"
      disabled={disabled}
      data-testid="product-video-fields"
    >
      <legend className="sr-only">
        {t("video.seller.sectionTitle", { count: videoCount, max: 1 })}
      </legend>

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground" aria-hidden="true">
            {t("video.seller.sectionTitle", { count: videoCount, max: 1 })}
          </p>
        </div>
      </div>

      <VideoUploadDropzone
        uploadState={state}
        onFileSelected={upload}
        onCancel={state.phase === "error" ? retry : cancel}
        disabled={disabled}
        maxSizeLabel="500MB"
      />

      {statusVideoId ? <VideoUploadProgress videoId={statusVideoId} /> : null}

      {productVideos.isError ? (
        <button
          type="button"
          className="text-xs font-medium text-error underline underline-offset-2"
          onClick={() => void productVideos.refetch()}
        >
          {t("video.tab.loadErr")}
        </button>
      ) : null}
    </fieldset>
  );
}
