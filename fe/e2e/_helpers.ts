import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Asserts no global error banner is visible on the page.
 * Shared across all e2e specs to avoid 25 duplicate definitions.
 */
export async function expectNoGlobalError(page: Page): Promise<void> {
  await expect(page.getByText(/Có lỗi xảy ra|Something went wrong/i)).toHaveCount(0);
  await expect(page.getByText(/Invalid input/i)).toHaveCount(0);
}
