import { z } from "zod";

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

export const apiResponseSchema = <TData>(data: z.ZodType<TData>) =>
  z.object({
    success: z.boolean(),
    message: z.string(),
    data,
    errorCode: z.string().nullable(),
    timestamp: z.string(),
    meta: apiMetaSchema.optional(),
  });

export type ApiResponse<TData> = z.infer<ReturnType<typeof apiResponseSchema<TData>>>;

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

export function isCursorResetError(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    (error.errorCode === "cursor_invalid" || error.errorCode === "cursor_scope_mismatch")
  );
}
