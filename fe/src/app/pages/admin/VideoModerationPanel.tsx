import { useState } from "react";
import { useTranslation } from "react-i18next";

import { VideoModeration } from "./VideoModeration";
import { VideoAppeals } from "./VideoAppeals";

type SubTab = "queue" | "appeals";

export function VideoModerationPanel() {
  const { t } = useTranslation();
  const [subTab, setSubTab] = useState<SubTab>("queue");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-border" role="tablist">
        <button
          role="tab"
          aria-selected={subTab === "queue"}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            subTab === "queue"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setSubTab("queue")}
        >
          {t("admin.nav.videoModeration")}
        </button>
        <button
          role="tab"
          aria-selected={subTab === "appeals"}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            subTab === "appeals"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setSubTab("appeals")}
        >
          {t("admin.nav.videoAppeals")}
        </button>
      </div>

      {subTab === "queue" ? <VideoModeration /> : <VideoAppeals />}
    </div>
  );
}
