import { Video } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { adminVideoPreview } from "@/shared/api/endpoints/admin";
import { Drawer } from "@/shared/ui/drawer";

import type { VideoModerationView } from "../model/video-queue-view";

interface VideoPreviewDrawerProps {
  video: VideoModerationView | null;
  onClose: () => void;
  onApprove: (videoId: string) => void;
  onReject: (videoId: string) => void;
  isMutating: boolean;
  approveLabel: string;
  rejectLabel: string;
}

/**
 * Side drawer for video preview. Distinct from the AdminQueueFrame drawer
 * because the preview surface needs a fixed 16:9 aspect-ratio video
 * container that doesn't fit cleanly inside the standard record drawer.
 */
export function VideoPreviewDrawer({
  video,
  onClose,
  onApprove,
  onReject,
  isMutating,
  approveLabel,
  rejectLabel,
}: VideoPreviewDrawerProps) {
  const { t } = useTranslation();
  const videoId = video?.videoId ?? null;
  const { data: preview, isLoading } = useQuery({
    queryKey: ["admin", "video", "preview", videoId ?? ""],
    queryFn: async () => {
      if (!videoId) throw new Error("A video ID is required to fetch a preview");
      return adminVideoPreview(videoId);
    },
    enabled: videoId !== null,
    retry: false,
  });

  const poster = video?.posterUrl ?? undefined;
  const src = preview?.url;

  return (
    <Drawer
      open={video !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={video?.videoId ?? ""}
      description={video?.uploaderName ?? undefined}
      footer={
        <>
          <button
            onClick={() => video && onReject(video.videoId)}
            disabled={!video || isMutating}
            className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-500 disabled:opacity-50"
          >
            {rejectLabel}
          </button>
          <button
            onClick={() => video && onApprove(video.videoId)}
            disabled={!video || isMutating}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--success)" }}
          >
            {approveLabel}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
          {isLoading ? (
            <div className="flex h-full w-full items-center justify-center">
              <p className="text-sm text-white/60">
                {t("admin.videoModeration.loadingPreview")}
              </p>
            </div>
          ) : src ? (
            <video src={src} poster={poster} controls className="h-full w-full">
              <track kind="captions" srcLang="vi" label="Captions unavailable" />
            </video>
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Video size={48} className="text-white/40" aria-hidden="true" />
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}
