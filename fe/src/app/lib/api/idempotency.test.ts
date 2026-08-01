import { describe, expect, it } from "vitest";

import { newIdempotencyKey } from "./idempotency";

describe("newIdempotencyKey", () => {
  it("returns a UUIDv4-shaped string", () => {
    const key = newIdempotencyKey();
    // RFC 4122 v4: 8-4-4-4-12 hex with version 4 in 13th char and variant 8/9/a/b in 17th.
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("returns distinct keys across calls", () => {
    const a = newIdempotencyKey();
    const b = newIdempotencyKey();
    const c = newIdempotencyKey();
    expect(new Set([a, b, c]).size).toBe(3);
  });
});
