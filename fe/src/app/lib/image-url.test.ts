import { cdnUrl } from "./image-url";

describe("cdnUrl", () => {
  it("returns empty string for null", () => {
    expect(cdnUrl(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(cdnUrl(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(cdnUrl("")).toBe("");
  });

  it("passes through full URL as-is", () => {
    expect(cdnUrl("https://cdn.example.com/file/abc123")).toBe(
      "https://cdn.example.com/file/abc123",
    );
  });

  // The two remaining cases depend on VITE_CDN_BASE being set at build time.
  // When set (production) → prefix + /file/<hash>
  // When unset (dev default) → /file/<hash>
  // We test based on the actual runtime value rather than trying to override
  // import.meta.env at runtime (Vite replaces the token at build time).
  it.each([
    { hash: "f4e3b2a1", suffix: "/file/f4e3b2a1" },
    { hash: "abc123xyz", suffix: "/file/abc123xyz" },
  ])("resolves hash $hash to $suffix", ({ hash, suffix }) => {
    const result = cdnUrl(hash);
    expect(result).toBe(suffix);
  });
});
