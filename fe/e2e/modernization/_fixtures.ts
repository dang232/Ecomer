import { expect, test as base, type Page, type Locator } from "@playwright/test";

// loginAsPersona is re-exported from _auth.ts.
import { loginAsPersona } from "../_auth";

type PersonaFixtures = {
  loginBuyer: () => Promise<void>;
  loginSeller: () => Promise<void>;
  loginAdmin: () => Promise<void>;
};

export const test = base.extend<PersonaFixtures>({
  // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture uses non-React `use` callback pattern
  loginBuyer: async ({ page }, use) => use(() => loginAsPersona(page, "buyer")),
  // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture uses non-React `use` callback pattern
  loginSeller: async ({ page }, use) => use(() => loginAsPersona(page, "seller")),
  // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture uses non-React `use` callback pattern
  loginAdmin: async ({ page }, use) => use(() => loginAsPersona(page, "admin")),
});

export { expect };

/**
 * Assert no horizontal page overflow at the current scroll position.
 * Fails the test when the document scroll width exceeds the client width,
 * indicating content is clipped or the layout is unstable.
 */
export async function expectNoPageOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
}

/**
 * Compute the bounding boxes of two locators and assert they do not overlap.
 * Used for mobile bottom nav, product purchase bar, and sticky header
 * overlap assertions in the visual matrix.
 */
export async function expectNoIntersection(first: Locator, second: Locator): Promise<void> {
  const [a, b] = await Promise.all([first.boundingBox(), second.boundingBox()]);
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  if (!a || !b) return;
  const intersects =
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  expect(intersects).toBe(false);
}
