import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { VideoDecisionDialog } from "./video-decision-dialog";

// Map the i18n keys the dialog uses to readable defaults so the role/name
// queries in the tests are stable. Other keys return as-is.
vi.mock("react-i18next", () => {
  const dict: Record<string, string> = {
    "admin.videoModeration.rejectDialog.title": "Reject Video",
    "admin.videoModeration.rejectDialog.submit": "Reject",
    "admin.videoAppeals.rejectDialog.title": "Reject Appeal",
    "admin.videoAppeals.rejectDialog.submit": "Reject",
    "admin.queue.reasonRequired": "Reason is required",
    "admin.queue.reasonLabel": "Reason",
    "common.cancel": "Cancel",
  };
  return {
    useTranslation: () => ({
      t: (key: string) => dict[key] ?? key,
      i18n: { language: "en" },
    }),
  };
});

describe("video-moderation-queue", () => {
  describe("VideoDecisionDialog", () => {
    it("renders reject variant with reason field", () => {
      render(
        <VideoDecisionDialog
          variant="reject"
          videoId="v-1"
          onConfirm={() => undefined}
          onCancel={() => undefined}
        />,
      );
      expect(screen.getByText("Reject Video")).toBeInTheDocument();
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("renders reject-appeal variant with reason field", () => {
      render(
        <VideoDecisionDialog
          variant="reject-appeal"
          videoId="v-2"
          onConfirm={() => undefined}
          onCancel={() => undefined}
        />,
      );
      expect(screen.getByText("Reject Appeal")).toBeInTheDocument();
    });

    it("blocks confirm when reason is empty", async () => {
      const onConfirm = vi.fn();
      render(
        <VideoDecisionDialog
          variant="reject"
          videoId="v-3"
          onConfirm={onConfirm}
          onCancel={() => undefined}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Reject" }));
      await waitFor(() =>
        expect(screen.getByText("Reason is required")).toBeInTheDocument(),
      );
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it("blocks confirm when reason is whitespace only", async () => {
      const onConfirm = vi.fn();
      render(
        <VideoDecisionDialog
          variant="reject"
          videoId="v-4"
          onConfirm={onConfirm}
          onCancel={() => undefined}
        />,
      );
      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "   " } });
      fireEvent.click(screen.getByRole("button", { name: "Reject" }));
      await waitFor(() =>
        expect(screen.getByText("Reason is required")).toBeInTheDocument(),
      );
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it("trims reason before passing to onConfirm", () => {
      const onConfirm = vi.fn();
      render(
        <VideoDecisionDialog
          variant="reject"
          videoId="v-5"
          onConfirm={onConfirm}
          onCancel={() => undefined}
        />,
      );
      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "  bad content  " } });
      fireEvent.click(screen.getByRole("button", { name: "Reject" }));
      expect(onConfirm).toHaveBeenCalledWith({ reason: "bad content" });
    });
  });
});