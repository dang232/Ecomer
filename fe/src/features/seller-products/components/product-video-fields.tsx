import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  VideoUploadDropzone,
  VideoUploadProgress,
  useProductVideos,
  useVideoUpload,
} from "@/features/videos";
import { videoDelete } from "@/shared/api/endpoints/videos";

const MAX_PRODUCT_VIDEOS = 3;

interface ProductVideoFieldsProps {
  productId: string;
  disabled?: boolean;
}

interface CompletedVideoLatch {
  entityId: string;
  videoId: string;
}

export function ProductVideoFields({ productId, disabled = false }: ProductVideoFieldsProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [completedVideo, setCompletedVideo] = useState<CompletedVideoLatch | null>(null);
  const [removingVideoId, setRemovingVideoId] = useState<string | null>(null);
  const { state, upload, cancel, reset, retry } = useVideoUpload({
    entityId: productId,
    context: "PRODUCT",
    onComplete: (videoId) => setCompletedVideo({ entityId: productId, videoId }),
  });
  const productVideos = useProductVideos(productId);
  const persistedVideos = productVideos.videos.filter((video) => video.status === "PUBLISHED");
  const uploadVideoId = state.entityId === productId ? state.videoId : null;
  const completedVideoId = completedVideo?.entityId === productId ? completedVideo.videoId : null;
  const trackedVideoId = uploadVideoId ?? completedVideoId;
  const trackedVideoIsPersisted = persistedVideos.some((video) => video.id === trackedVideoId);
  const statusVideoId = trackedVideoId ?? persistedVideos[0]?.id ?? null;
  const videoCount = Math.min(
    MAX_PRODUCT_VIDEOS,
    persistedVideos.length + (trackedVideoId && !trackedVideoIsPersisted ? 1 : 0),
  );

  const removeVideo = async (videoId: string) => {
    if (!window.confirm(t("video.seller.deleteConfirm"))) return;

    setRemovingVideoId(videoId);
    try {
      await videoDelete(videoId);
      await queryClient.invalidateQueries({ queryKey: ["videos", "product", productId] });
      if (completedVideoId === videoId) setCompletedVideo(null);
      if (uploadVideoId === videoId) reset();
      toast.success(t("seller.products.editor.videoDeleted"));
    } catch {
      toast.error(t("seller.products.editor.videoDeleteErr"));
    } finally {
      setRemovingVideoId(null);
    }
  };

  return (
    <fieldset
      className="space-y-3 border-t border-border pt-4"
      disabled={disabled}
      data-testid="product-video-fields"
      onMouseDown={(event) => event.preventDefault()}
    >
      <legend className="sr-only">
        {t("video.seller.sectionTitle", { count: videoCount, max: MAX_PRODUCT_VIDEOS })}
      </legend>

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground" aria-hidden="true">
            {t("video.seller.sectionTitle", { count: videoCount, max: MAX_PRODUCT_VIDEOS })}
          </p>
        </div>
      </div>

      {persistedVideos.length > 0 ? (
        <div className="space-y-2">
          {persistedVideos.map((video, index) => (
            <div
              key={video.id}
              className="flex min-w-0 items-center gap-3 rounded-[var(--radius-md)] border border-border bg-muted/40 p-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {video.originalFilename ??
                    t("video.tab.videoLabel", {
                      index: index + 1,
                      total: persistedVideos.length,
                    })}
                </p>
                <p className="text-xs text-muted-foreground">{video.status}</p>
              </div>
              <button
                type="button"
                onClick={() => void removeVideo(video.id)}
                disabled={disabled || removingVideoId === video.id}
                aria-label={t("seller.products.editor.removeVideo")}
                className="inline-flex min-h-8 min-w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-error transition-colors hover:bg-error/10 disabled:opacity-50"
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {videoCount < MAX_PRODUCT_VIDEOS ? (
        <VideoUploadDropzone
          uploadState={state}
          onFileSelected={upload}
          onCancel={state.phase === "error" ? retry : cancel}
          disabled={disabled}
          maxSizeLabel="500MB"
        />
      ) : null}

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
