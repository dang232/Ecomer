import { describe, expect, it } from "vitest";

import { formatGroupedNumber } from "./format";

describe("formatGroupedNumber", () => {
  it("groups an integer for a numeric money input", () => {
    expect(formatGroupedNumber(9000)).toBe("9,000");
  });

  it("keeps zero empty for a blank numeric input", () => {
    expect(formatGroupedNumber(0)).toBe("");
  });
});
