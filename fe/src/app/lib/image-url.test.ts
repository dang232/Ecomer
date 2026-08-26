import { describe, expect, it, vi } from "vitest";

import { cdnUrl } from "@/shared/lib/image-url";

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

describe("responsive image transforms", () => {
  it("uses preset-specific allowlisted candidates when the CDN is enabled", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_IMAGE_CDN_MODE", "cloudflare");
    vi.stubEnv("VITE_IMAGE_ALLOWED_ORIGINS", "https://images.example.com");

    const { imageSrcSet } = await import("@/shared/lib/image-url");
    const srcSet = imageSrcSet("https://images.example.com/products/v1/item.jpg", "avatar");

    expect(srcSet).toContain(" 80w");
    expect(srcSet).toContain(" 160w");
    expect(srcSet).toContain(" 320w");
    expect(srcSet).not.toContain(" 400w");
  });

  it("rounds transform dimensions and quality to allowlisted values and protects signed query delimiters", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_IMAGE_CDN_MODE", "cloudflare");
    vi.stubEnv("VITE_IMAGE_ALLOWED_ORIGINS", "https://images.example.com");

    const { imageUrl } = await import("@/shared/lib/image-url");
    const transformed = imageUrl(
      "https://images.example.com/products/v1/item.jpg?X-Amz-Signature=a,b#fragment",
      "detail",
      1,
      700,
      83,
    );

    expect(transformed).toContain("width=800");
    expect(transformed).toContain("quality=85");
    expect(transformed).toContain("%3FX-Amz-Signature%3Da%2Cb%23fragment");
  });
});
