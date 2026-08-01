import { z } from "zod";

/**
 * Mirrors {@code TrackingResponse} from the shipping-service. We keep
 * {@link Object#passthrough} so we don't break when the BE adds new fields
 * (e.g. carrier metadata) ahead of the FE catching up.
 */
const trackingEventSchema = z
  .object({
    at: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
  })
  .passthrough();

export const trackingResponseSchema = z
  .object({
    trackingCode: z.string(),
    carrier: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    estimatedDelivery: z.string().nullable().optional(),
    events: z.array(trackingEventSchema).default([]),
  })
  .passthrough();

export type TrackingResponse = z.infer<typeof trackingResponseSchema>;
export type TrackingEvent = z.infer<typeof trackingEventSchema>;
