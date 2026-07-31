import { createQueryOptions } from "@tanstack/react-query";

import {
  adminVideoAppealsQueue,
  adminVideoModerationQueue,
} from "@/shared/api/endpoints/admin";

import { moderationUiPageToBackend } from "../model/video-queue-view";

export const adminVideoModerationQueryOptions = (params: {
  page: number;
  size?: number;
}) =>
  createQueryOptions({
    queryKey: ["admin", "video", "moderation", params.page],
    queryFn: () =>
      adminVideoModerationQueue({
        page: moderationUiPageToBackend(params.page),
        size: params.size ?? 20,
      }),
    retry: false,
  });

export const adminVideoAppealsQueryOptions = (params: {
  page: number;
  size?: number;
}) =>
  createQueryOptions({
    queryKey: ["admin", "video", "appeals", params.page],
    queryFn: () => {
      // The endpoint accepts { page, size }; UI page → backend page is mapped
      // here so callers stay 1-based.
      return adminVideoAppealsQueue({
        page: moderationUiPageToBackend(params.page),
        size: params.size ?? 20,
      });
    },
    retry: false,
  });