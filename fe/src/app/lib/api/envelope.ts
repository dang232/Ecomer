import { z } from "zod";

export const apiResponseSchema = <T extends z.ZodType>(
  data: T,
): z.ZodType<ApiResponse<z.infer<T>>> =>
  z.object({
    success: z.boolean(),
    message: z.string(),
    data,
    errorCode: z.string().nullable(),
    timestamp: z.string(),
    meta: apiMetaSchema.optional(),
  }) as unknown as z.ZodType<ApiResponse<z.infer<T>>>;

export const apiMetaSchema = z
  .object({
    requestId: z.string().optional(),
    cacheStatus: z.enum(["hit", "miss", "stale", "bypass"]).optional(),
    stale: z.boolean().optional(),
    nextCursor: z.string().nullable().optional(),
    hasMore: z.boolean().optional(),
  })
  .passthrough();

export type ApiMeta = z.infer<typeof apiMetaSchema>;

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errorCode: string | null;
  timestamp: string;
  meta?: ApiMeta;
}

export class ApiError extends Error {
  readonly status: number;
  readonly errorCode: string | null;
  readonly correlationId: string | undefined;
  readonly retryAfterMs: number | undefined;

  constructor(
    status: number,
    errorCode: string | null,
    message: string,
    correlationId?: string,
    retryAfterMs?: number,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errorCode = errorCode;
    this.correlationId = correlationId;
    this.retryAfterMs = retryAfterMs;
  }
}
