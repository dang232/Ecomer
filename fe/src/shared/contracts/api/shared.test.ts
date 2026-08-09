import { describe, expect, it } from "vitest";
import { z } from "zod";

import { cursorErrorSchema, cursorPageSchema, pageSchema } from "@/shared/contracts/api/shared";

describe("shared pagination contracts", () => {
  it("accepts a cursor page with sort and snapshot metadata", () => {
    const parsed = cursorPageSchema(z.object({ id: z.string() })).parse({
      items: [{ id: "order-1" }],
      nextCursor: "opaque-next",
      hasMore: true,
      pageSize: 50,
      sort: { field: "createdAt", direction: "desc" },
      snapshot: { asOf: "2026-08-08T00:00:00Z" },
    });

    expect(parsed).toMatchObject({
      items: [{ id: "order-1" }],
      nextCursor: "opaque-next",
      hasMore: true,
      pageSize: 50,
      sort: { field: "createdAt", direction: "desc" },
      snapshot: { asOf: "2026-08-08T00:00:00Z" },
    });
  });

  it("accepts a cursor page with a null snapshot", () => {
    expect(
      cursorPageSchema(z.object({ id: z.string() })).parse({
        items: [],
        nextCursor: null,
        hasMore: false,
        snapshot: null,
      }),
    ).toMatchObject({ items: [], nextCursor: null, hasMore: false, snapshot: null });
  });

  it("accepts null nextCursor and rejects a missing hasMore", () => {
    const schema = cursorPageSchema(z.string());

    expect(
      schema.parse({
        items: ["item-1"],
        nextCursor: null,
        hasMore: false,
        pageSize: 25,
        sort: { field: "createdAt", direction: "desc" },
      }).nextCursor,
    ).toBeNull();

    expect(() =>
      schema.parse({
        items: [],
        nextCursor: null,
        pageSize: 25,
        sort: { field: "createdAt", direction: "desc" },
      }),
    ).toThrow();

    expect(() =>
      schema.parse({
        items: [],
        hasMore: false,
        pageSize: 25,
        sort: { field: "createdAt", direction: "desc" },
      }),
    ).toThrow();
  });

  it.each([
    "cursor_invalid",
    "cursor_scope_mismatch",
    "invalid_page_size",
    "invalid_sort",
  ] as const)(
    "represents the stable cursor failure code %s in the API envelope field",
    (errorCode) => {
      expect(cursorErrorSchema.parse({ errorCode, message: "Request rejected" })).toEqual({
        errorCode,
        message: "Request rejected",
      });
    },
  );

  it("continues to parse legacy offset pages", () => {
    expect(
      pageSchema(z.string()).parse({
        content: ["item-1"],
        number: 2,
        size: 50,
        totalElements: 101,
        totalPages: 3,
      }),
    ).toMatchObject({ content: ["item-1"], page: 2, number: 2 });
  });
});
