import { useRef, useState } from "react";
import { Play, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

// ─── Types ───────────────────────────────────────────────────────────────────

interface VideoPlayerProps {
  src: string;
  poster?: string | null;
  title?: string;
  className?: string;
  /** If true, render a loading skeleton instead of the player. */
  loading?: boolean;
}

// ─── Loading skeleton ────────────────────────────────────────────────────────

function VideoPlayerSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={[
        "relative aspect-video w-full rounded-[var(--radius-xl)] overflow-hidden bg-surface-elevated animate-pulse",
        className,
      ].join(" ")}
      aria-hidden="true"
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-muted" />
      </div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function VideoPlayer({ src, poster, title, className = "", loading = false }: VideoPlayerProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [buffering, setBuffering] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [showPoster, setShowPoster] = useState(true);

  if (loading) return <VideoPlayerSkeleton className={className} />;

  function handlePlay() {
    setPlaying(true);
    setShowPoster(false);
  }

  function handlePause() {
    setPlaying(false);
  }

  function handleWaiting() {
    setBuffering(true);
  }

  function handleCanPlay() {
    setBuffering(false);
  }

  function handleClickOverlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  }

  return (
    <div
      className={[
        "relative aspect-video w-full rounded-[var(--radius-xl)] overflow-hidden bg-black group",
        className,
      ].join(" ")}
    >
      {/* Native video element — accessible via keyboard through native controls */}
      <video
        ref={videoRef}
        src={src}
        poster={poster ?? undefined}
        controls
        playsInline
        preload="metadata"
        title={title}
        aria-label={title ?? t("video.player.ariaLabel")}
        className="w-full h-full object-contain"
        onPlay={handlePlay}
        onPause={handlePause}
        onWaiting={handleWaiting}
        onCanPlay={handleCanPlay}
        onPlaying={handleCanPlay}
      />

      {/* Custom big-play overlay shown before first play on poster */}
      {showPoster && !playing && (
        <button
          type="button"
          aria-label={t("video.player.playAria")}
          onClick={handleClickOverlay}
          className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors group-hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
            <Play size={24} className="text-gray-900 ml-1" fill="currentColor" />
          </div>
        </button>
      )}

      {/* Buffering spinner */}
      {buffering && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none"
          aria-live="polite"
          aria-label={t("video.player.buffering")}
        >
          <Loader2 size={32} className="text-white animate-spin" />
        </div>
      )}
    </div>
  );
}
