/**
 * VideoModerationRoute — Plan 07 direct-route adapter.
 * Bridges the `/admin/video` route to feature components.
 * URL-owned sub-tab state (queue | appeals) lives in `?tab=` search param.
 */

import { useRef } from "react";
import type { KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import {
  VideoAppealsQueue,
  VideoModerationQueue,
} from "@/features/admin-video";

type SubTab = "queue" | "appeals";

const SUB_TABS: SubTab[] = ["queue", "appeals"];

export function VideoModerationRoute() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const subTab = (tabParam === "appeals" ? "appeals" : "queue");

  const queueBtnRef = useRef<HTMLButtonElement>(null);
  const appealsBtnRef = useRef<HTMLButtonElement>(null);

  const focusTab = (next: SubTab) => {
    setSearchParams(
      (prev) => {
        const nextParams = new URLSearchParams(prev);
        if (next === "queue") nextParams.delete("tab");
        else nextParams.set("tab", "appeals");
        return nextParams;
      },
      { replace: true },
    );
    (next === "queue" ? queueBtnRef : appealsBtnRef).current?.focus();
  };

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>, current: SubTab) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const idx = SUB_TABS.indexOf(current);
      focusTab(SUB_TABS[(idx + 1) % SUB_TABS.length]);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const idx = SUB_TABS.indexOf(current);
      focusTab(SUB_TABS[(idx - 1 + SUB_TABS.length) % SUB_TABS.length]);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusTab("queue");
    } else if (e.key === "End") {
      e.preventDefault();
      focusTab("appeals");
    }
  }

  return (
    <div className="space-y-4">
      <div
        className="flex gap-1 border-b border-border"
        role="tablist"
        aria-label="Video moderation views"
      >
        <button
          ref={queueBtnRef}
          role="tab"
          id="video-moderation-queue-tab"
          aria-selected={subTab === "queue"}
          aria-controls="video-moderation-queue-panel"
          tabIndex={subTab === "queue" ? 0 : -1}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
            subTab === "queue"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => focusTab("queue")}
          onKeyDown={(e) => handleKeyDown(e, "queue")}
        >
          {t("admin.nav.videoModeration")}
        </button>
        <button
          ref={appealsBtnRef}
          role="tab"
          id="video-moderation-appeals-tab"
          aria-selected={subTab === "appeals"}
          aria-controls="video-moderation-appeals-panel"
          tabIndex={subTab === "appeals" ? 0 : -1}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
            subTab === "appeals"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => focusTab("appeals")}
          onKeyDown={(e) => handleKeyDown(e, "appeals")}
        >
          {t("admin.nav.videoAppeals")}
        </button>
      </div>

      <div
        id={subTab === "queue" ? "video-moderation-queue-panel" : "video-moderation-appeals-panel"}
        role="tabpanel"
        aria-labelledby={
          subTab === "queue" ? "video-moderation-queue-tab" : "video-moderation-appeals-tab"
        }
      >
        {subTab === "queue" ? <VideoModerationQueue /> : <VideoAppealsQueue />}
      </div>
    </div>
  );
}
