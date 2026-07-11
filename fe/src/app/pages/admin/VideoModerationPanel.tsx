import { useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";

import { VideoAppeals } from "./VideoAppeals";
import { VideoModeration } from "./VideoModeration";

type SubTab = "queue" | "appeals";

const SUB_TABS: SubTab[] = ["queue", "appeals"];

/**
 * Video Moderation sub-tab panel (Queue / Appeals).
 *
 * BA audit 2026-06-16 P1-12: roving tabindex + ArrowLeft/ArrowRight keyboard
 * navigation + aria-controls on each tab so screen readers can navigate
 * the tablist without a mouse. Pattern: WAI-ARIA Authoring Practices
 * "Tabs with Manual Activation".
 */
export function VideoModerationPanel() {
  const { t } = useTranslation();
  const [subTab, setSubTab] = useState<SubTab>("queue");
  const queueBtnRef = useRef<HTMLButtonElement>(null);
  const appealsBtnRef = useRef<HTMLButtonElement>(null);

  const refs = { queue: queueBtnRef, appeals: appealsBtnRef };

  const focusTab = useCallback((next: SubTab) => {
    setSubTab(next);
    refs[next].current?.focus();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, current: SubTab) {
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
      <div className="flex gap-1 border-b border-border" role="tablist" aria-label="Video moderation views">
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
          onClick={() => setSubTab("queue")}
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
          onClick={() => setSubTab("appeals")}
          onKeyDown={(e) => handleKeyDown(e, "appeals")}
        >
          {t("admin.nav.videoAppeals")}
        </button>
      </div>

      <div
        id={subTab === "queue" ? "video-moderation-queue-panel" : "video-moderation-appeals-panel"}
        role="tabpanel"
        aria-labelledby={subTab === "queue" ? "video-moderation-queue-tab" : "video-moderation-appeals-tab"}
      >
        {subTab === "queue" ? <VideoModeration /> : <VideoAppeals />}
      </div>
    </div>
  );
}
