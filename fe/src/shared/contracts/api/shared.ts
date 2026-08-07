import { z } from "zod";

export const moneySchema = z
  .object({
    amount: z.number(),
    currency: z.string().default("VND"),
  })
  .passthrough();

// Spring's Page<T> emits `number` for the current page index;
// user-service PublicSellersPageResponse uses `page` instead. Accept both
// and surface them under both keys so consumers don't need to probe at runtime.
export const pageSchema = <T extends z.ZodType>(item: T) =>
  z
    .object({
      content: z.array(item),
      totalElements: z.number().optional(),
      totalPages: z.number().optional(),
      number: z.number().optional(),
      page: z.number().optional(),
      size: z.number().optional(),
      first: z.boolean().optional(),
      last: z.boolean().optional(),
    })
    .passthrough()
    .transform((raw) => ({
      content: raw.content,
      totalElements: raw.totalElements,
      totalPages: raw.totalPages,
      page: raw.page ?? raw.number,
      number: raw.number ?? raw.page,
      size: raw.size,
      first: raw.first,
      last: raw.last,
    }));

export interface Page<T> {
  content: T[];
  totalElements?: number;
  totalPages?: number;
  number?: number;
  page?: number;
  size?: number;
  first?: boolean;
  last?: boolean;
}

export const cursorSortSchema = z.object({
  field: z.string(),
  direction: z.enum(["asc", "desc"]),
});
export type CursorSort = z.infer<typeof cursorSortSchema>;

export const cursorSnapshotSchema = z
  .object({
    asOf: z.string(),
  })
  .passthrough();
export type CursorSnapshot = z.infer<typeof cursorSnapshotSchema>;

export const cursorErrorCodeSchema = z.enum([
  "cursor_invalid",
  "cursor_scope_mismatch",
  "invalid_page_size",
  "invalid_sort",
]);
export type CursorErrorCode = z.infer<typeof cursorErrorCodeSchema>;

export const cursorErrorSchema = z
  .object({
    code: cursorErrorCodeSchema,
    message: z.string().optional(),
  })
  .passthrough();
export type CursorError = z.infer<typeof cursorErrorSchema>;

export const cursorPageSchema = <T extends z.ZodType>(item: T) =>
  z
    .object({
      items: z.array(item),
      nextCursor: z.string().nullable().optional(),
      hasMore: z.boolean(),
      pageSize: z.number().int().min(1).max(100).optional(),
      sort: cursorSortSchema.optional(),
      snapshot: cursorSnapshotSchema.optional(),
      facets: z.unknown().optional(),
    })
    .passthrough();

export interface CursorPage<T> {
  items: T[];
  nextCursor?: string | null;
  hasMore: boolean;
  pageSize?: number;
  sort?: CursorSort;
  snapshot?: CursorSnapshot;
  facets?: unknown;
}

export const addressSchema = z
  .object({
    street: z.string(),
    // BE order-service persists addresses with nullable ward/district when
    // the buyer left them blank at checkout. The FE form still collects
    // them, but old rows in order_summary carry literal `null` — accept
    // both `null` and `undefined` so the seller's Orders tab doesn't
    // crash on legacy data. Caught by AC-3.1 of the BA-grade journey
    // suite (chapter 3) when the queue accumulated old rows.
    ward: z.string().nullable().optional(),
    district: z.string().nullable().optional(),
    city: z.string(),
    isDefault: z.boolean().optional(),
    // Kept FE-side only — the form still collects phone for UX, but the
    // user-service Address record drops it on POST and doesn't return it
    // on GET. Treat as optional/best-effort until the BE shape grows.
    phone: z.string().nullable().optional(),
  })
  .passthrough();
export type Address = z.infer<typeof addressSchema>;

/**
 * Generic empty / 204 response. The clear-cart endpoint and a handful of
 * admin actions resolve with no body — accept null, undefined, or {}.
 */
export const emptyResponseSchema = z.union([z.null(), z.undefined(), z.object({}).passthrough()]);
