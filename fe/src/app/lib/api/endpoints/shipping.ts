import {
  trackingResponseSchema,
  type TrackingEvent,
  type TrackingResponse,
} from "../../../types/api";
import { api } from "../client";

export type { TrackingEvent, TrackingResponse };
export { trackingResponseSchema };

export const getTracking = (trackingCode: string, carrier: string) =>
  api.get(`/shipping/tracking/${encodeURIComponent(trackingCode)}`, trackingResponseSchema, {
    carrier,
  });
