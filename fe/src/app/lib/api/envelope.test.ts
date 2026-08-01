import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ApiError, apiResponseSchema } from "./envelope";

describe("apiResponseSchema", () => {
  const schema = apiResponseSchema(z.object({ id: z.string() }));

  it("accepts a well-formed success envelope", () => {
    const parsed = schema.parse({
      success: true,
      message: "ok",
      data: { id: "p1" },
      errorCode: null,
      timestamp: "2026-05-15T00:00:00Z",
    });
    expect(parsed.data).toEqual({ id: "p1" });
    expect(parsed.errorCode).toBeNull();
  });

  it("rejects an envelope missing the success flag", () => {
    const result = schema.safeParse({
      message: "ok",
      data: { id: "p1" },
      errorCode: null,
      timestamp: "2026-05-15T00:00:00Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an envelope where data fails the inner schema", () => {
    const result = schema.safeParse({
      success: true,
      message: "ok",
      data: { id: 42 },
      errorCode: null,
      timestamp: "2026-05-15T00:00:00Z",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a string errorCode for failure responses", () => {
    const parsed = schema.parse({
      success: false,
      message: "not found",
      data: { id: "p1" },
      errorCode: "PRODUCT_NOT_FOUND",
      timestamp: "2026-05-15T00:00:00Z",
    });
    expect(parsed.success).toBe(false);
    expect(parsed.errorCode).toBe("PRODUCT_NOT_FOUND");
  });
});

describe("ApiError", () => {
  it("captures status, errorCode, message, and correlationId", () => {
    const err = new ApiError(503, "SERVICE_UNAVAILABLE", "downstream is down", "abc-123");
    expect(err.status).toBe(503);
    expect(err.errorCode).toBe("SERVICE_UNAVAILABLE");
    expect(err.message).toBe("downstream is down");
    expect(err.correlationId).toBe("abc-123");
    expect(err.name).toBe("ApiError");
    expect(err).toBeInstanceOf(Error);
  });

  it("allows null errorCode (e.g., transport-level failure)", () => {
    const err = new ApiError(500, null, "boom");
    expect(err.errorCode).toBeNull();
    expect(err.correlationId).toBeUndefined();
  });
});
