import { describe, expect, it, vi } from "vitest";

import { logger } from "./logger";

describe("logger", () => {
  it("redacts sensitive fields and error messages", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logger.warn("test.event", {
      email: "buyer@example.test",
      token: "secret-token",
      error: new Error("contains user input"),
      status: 503,
    });

    expect(spy).toHaveBeenCalledWith({
      event: "test.event",
      email: "[REDACTED]",
      token: "[REDACTED]",
      error: { name: "Error", message: "[REDACTED]" },
      status: 503,
    });
    spy.mockRestore();
  });
});
