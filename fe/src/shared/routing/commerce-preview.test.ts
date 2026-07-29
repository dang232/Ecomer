import { describe, expect, it } from "vitest";

import { readCommercePreview } from "./commerce-preview";

describe("readCommercePreview", () => {
  it("accepts the modernized preview only in development", () => {
    expect(readCommercePreview("?__commercePreview=modernized", true)).toBe("modernized");
    expect(readCommercePreview("?__commercePreview=modernized", false)).toBe("current");
    expect(readCommercePreview("?__commercePreview=other", true)).toBe("current");
  });
});
