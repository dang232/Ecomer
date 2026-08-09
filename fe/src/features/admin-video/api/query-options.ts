import { queryOptions } from "@tanstack/react-query";

import {
  adminVideoAppealsQueue,
  adminVideoAppealsQueueCursor,
  adminVideoModerationQueue,
  adminVideoModerationQueueCursor,
} from "@/shared/api/endpoints/admin";

import { moderationUiPageToBackend } from "../model/video-queue-view";

export const adminVideoModerationQueryOptions = (params: { page: number; size?: number }) =>
  queryOptions({
    queryKey: ["admin", "video", "moderation", params.page],
    queryFn: () =>
      adminVideoModerationQueue({
        page: moderationUiPageToBackend(params.page),
        size: params.size ?? 20,
      }),
    retry: false,
  });

export const adminVideoAppealsQueryOptions = (params: { page: number; size?: number }) =>
  queryOptions({
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

export const adminVideoModerationCursorQueryOptions = (
  params: {
    cursor?: string;
    limit?: number;
  } = {},
) =>
  queryOptions({
    queryKey: ["admin", "video", "moderation", "cursor", params.cursor ?? null, params.limit ?? 20],
    queryFn: () =>
      adminVideoModerationQueueCursor({
        cursor: params.cursor,
        limit: params.limit ?? 20,
      }),
    retry: false,
  });

export const adminVideoAppealsCursorQueryOptions = (
  params: {
    cursor?: string;
    limit?: number;
  } = {},
) =>
  queryOptions({
    queryKey: ["admin", "video", "appeals", "cursor", params.cursor ?? null, params.limit ?? 20],
    queryFn: () =>
      adminVideoAppealsQueueCursor({
        cursor: params.cursor,
        limit: params.limit ?? 20,
      }),
    retry: false,
  });
