import type { Page } from "@playwright/test";

import { loginAsPersona } from "../_auth";

/**
 * Persona type used by acceptance suites (visual, state, accessibility, text-scale).
 * "public" means no authentication — the route must be accessible to unauthenticated users.
 */
export type AcceptancePersona = "public" | "buyer" | "seller" | "admin";

/**
 * Authenticate as the given acceptance persona.
 * No-op for "public"; calls loginAsPersona for all authenticated personas.
 */
export async function authenticateForPersona(
  page: Page,
  persona: AcceptancePersona,
): Promise<void> {
  if (persona !== "public") {
    await loginAsPersona(page, persona);
  }
}

/**
 * Authenticate based on the URL path.
 * Used when navigating directly to a path so the correct persona is logged in
 * before or during navigation.
 */
export async function authenticateForPath(page: Page, path: string): Promise<void> {
  if (path.startsWith("/seller")) return authenticateForPersona(page, "seller");
  if (path.startsWith("/admin")) return authenticateForPersona(page, "admin");
  if (
    /^\/(cart|checkout|orders|returns|profile|wishlist|messages|notifications|payment)/.test(path)
  ) {
    return authenticateForPersona(page, "buyer");
  }
}
