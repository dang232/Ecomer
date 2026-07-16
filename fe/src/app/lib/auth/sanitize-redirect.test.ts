import { describe, expect, it } from "vitest";

import { resolvePostLoginRedirect, sanitizeRedirect } from "./sanitize-redirect";

describe("post-login redirects", () => {
  it("preserves an explicit safe relative next URL", () => {
    expect(resolvePostLoginRedirect("/orders?status=SHIPPED", ["ADMIN"])).toBe(
      "/orders?status=SHIPPED",
    );
  });

  it("sends an admin to the admin console when next is absent", () => {
    expect(resolvePostLoginRedirect(null, ["ADMIN"])).toBe("/admin");
  });

  it("sends a buyer to the storefront when next is absent", () => {
    expect(resolvePostLoginRedirect(undefined, ["BUYER"])).toBe("/");
  });

  it("does not treat an external URL as a safe next URL", () => {
    expect(sanitizeRedirect("https://evil.example")).toBe("/");
    expect(resolvePostLoginRedirect("https://evil.example", ["ADMIN"])).toBe("/admin");
  });
});
