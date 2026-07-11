import { Play, Loader2, AlertCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VideoTrack {
  /** Source URL for the captions/track file. */
  src: string;
  /** BCP-47 language tag (e.g. "en", "vi"). */
  srclang: string;
  /** Human-readable label, e.g. "English". */
  label: string;
  /** Mark this track as the default. */
  default?: boolean;
}

interface VideoPlayerProps {
  src: string;
  poster?: string | null;
  title?: string;
  className?: string;
  /** If true, render a loading skeleton instead of the player. */
  loading?: boolean;
  /** Optional caption/subtitle tracks (WCAG 1.2.2 — AA). */
  tracks?: VideoTrack[];
}

// ─── Loading skeleton ────────────────────────────────────────────────────────

export function VideoPlayerSkeleton({ className = "" }: { className?: string }) {
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

export function VideoPlayer({ src, poster, title, className = "", loading = false, tracks }: VideoPlayerProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [buffering, setBuffering] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [showPoster, setShowPoster] = useState(true);
  const [error, setError] = useState(false);

  // P0-7: Stop audio and release hardware decoder on unmount. Browsers do not
  // automatically pause a video element when it's removed from the DOM if the
  // element is held by a ref — without this, navigating away from a playing
  // video lets the audio continue in the background.
  useEffect(() => {
    return () => {
      const v = videoRef.current;
      if (v) {
        v.pause();
        // Clear src to release the network connection and decoder
        v.removeAttribute("src");
        v.load();
      }
    };
  }, []);

  if (loading) return <VideoPlayerSkeleton className={className} />;

  function handlePlay() {
    setPlaying(true);
    setShowPoster(false);
    setError(false);
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

  // P0-6: Visible error state when the video URL fails to load (e.g. expired
  // signed CDN URL, network error, codec issue). Without this, the poster
  // remains on screen with no indication that anything went wrong — the user
  // assumes the product has no video and leaves.
  function handleError() {
    setError(true);
    setBuffering(false);
    setShowPoster(false);
    setPlaying(false);
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
        controls={!error}
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
        onError={handleError}
      >
        {/* WCAG 1.2.2 — Captions (Prerecorded, AA) */}
        {tracks?.map((track) => (
          <track
            key={track.srclang}
            kind="captions"
            src={track.src}
            srcLang={track.srclang}
            label={track.label}
            default={track.default}
          />
        ))}
      </video>

      {/* Custom big-play overlay shown before first play on poster */}
      {showPoster && !playing && !error ? <button
          type="button"
          aria-label={t("video.player.playAria")}
          onClick={handleClickOverlay}
          className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors group-hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
            <Play size={24} className="text-gray-900 ml-1" fill="currentColor" />
          </div>
        </button> : null}

      {/* Buffering spinner — role=status so screen readers announce it */}
      {buffering && !error ? <div
          className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none"
          role="status"
          aria-live="polite"
          aria-label={t("video.player.buffering")}
        >
          <Loader2 size={32} className="text-white animate-spin" />
        </div> : null}

      {/* Error overlay — visible feedback when the video fails to load */}
      {error ? <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-white p-6"
          role="alert"
        >
          <AlertCircle size={40} aria-hidden="true" />
          <p className="text-sm text-center max-w-xs">
            {t("video.player.error")}
          </p>
        </div> : null}
    </div>
  );
}
