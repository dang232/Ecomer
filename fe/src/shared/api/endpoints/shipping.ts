import {
  trackingResponseSchema,
  type TrackingEvent,
  type TrackingResponse,
} from "@/shared/contracts/api";
import { api } from "@/shared/api/client";

export type { TrackingEvent, TrackingResponse };
export { trackingResponseSchema };

export const getTracking = (trackingCode: string, carrier: string) =>
  api.get(`/shipping/tracking/${encodeURIComponent(trackingCode)}`, trackingResponseSchema, {
    carrier,
  });
