import { test, expect, type APIRequestContext } from "@playwright/test";

import { loginViaOidc, uniqueTestId } from "./_auth";
import { readJson, type AuthResponse } from "./_api";
import { expectNoGlobalError } from "./_helpers";

/**
 * UI-driven QA spec for the messaging page + notifications bell.
 *
 * What this proves through the actual SPA:
 *   - /messages as guest shows the login prompt
 *   - /messages for an authed buyer mounts past Suspense and shows the
 *     thread list (or its empty state) without the global error fallback
 *   - The notifications bell in the header opens its dropdown
 *
 * Locks in the pt28 notification schema (passthrough is intentional —
 * regression check for the dropdown shell).
 */

const apiURL = process.env.VITE_E2E_API_URL ?? "http://localhost:8080";
const PASSWORD = "Test1234!";

interface SeededBuyer {
  email: string;
  accessToken: string;
}

async function seedBuyer(request: APIRequestContext): Promise<SeededBuyer> {
  const stamp = uniqueTestId();
  const email = `e2e_qa_msg_${stamp}@vnshop.local`;
  const reg = await request.post(`${apiURL}/auth/register`, {
    data: { firstName: "QA", lastName: "Msg", email, password: PASSWORD },
  });
  expect(reg.ok(), `register: ${reg.status()} ${await reg.text()}`).toBeTruthy();
  const login = await request.post(`${apiURL}/auth/login`, {
    data: { username: email, password: PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  const accessToken = (await readJson<AuthResponse>(login)).data?.accessToken;
  expect(accessToken).toBeTruthy();
  if (!accessToken) throw new Error("login did not return an access token");
  return { email, accessToken };
}

test.describe("messages + notifications UI", () => {
  test("/messages as guest redirects to /login (route guard)", async ({ page }) => {
    await page.goto("/messages");

    await expect
      .poll(() => new URL(page.url()).pathname, {
        timeout: 20_000,
        message: "expected /messages to redirect to /login for guests",
      })
      .toMatch(/^\/login/);

    await expectNoGlobalError(page);
  });

  test("/messages for an authed buyer renders the thread list shell", async ({ page }) => {
    const buyer = await seedBuyer(page.request);
    await loginViaOidc(page, buyer.email, PASSWORD);
    await page.goto("/messages");

    // The thread list header is always visible; the body is either the
    // loading spinner, the empty state, or actual threads. Any of those is
    // a valid signal that the page mounted past Suspense.
    await expect(page.getByText(/^Messages$|^Tin nhắn$/i).first()).toBeVisible({
      timeout: 20_000,
    });

    // The "select a conversation" prompt renders on the right side when no
    // thread is selected — this is the canonical empty-pane state.
    await expect(
      page
        .getByText(
          /Pick a conversation to start chatting|Chọn một cuộc trò chuyện để bắt đầu|No conversations yet|Chưa có cuộc trò chuyện nào/i,
        )
        .first(),
    ).toBeVisible({ timeout: 15_000 });

    await expectNoGlobalError(page);
  });

  test("Notification bell button is visible in the header for authed buyers", async ({ page }) => {
    const buyer = await seedBuyer(page.request);
    await loginViaOidc(page, buyer.email, PASSWORD);
    await page.goto("/");

    // The bell button aria-label is the localized "Notifications" / "Thông báo".
    const bell = page.getByRole("button", { name: /^(Notifications|Thông báo)$/i }).first();
    await expect(bell).toBeVisible({ timeout: 20_000 });

    // Click the bell — its dropdown / panel should appear. The exact
    // content depends on the notification list's empty state, but
    // SOMETHING new should render after the click.
    await bell.click();

    // Either a thread / list panel renders OR an empty-state pops. We
    // accept any of the localized strings the panel uses.
    await expect(
      page
        .getByText(
          /Notifications|Thông báo|No notifications|Chưa có thông báo|Mark all as read|Đánh dấu tất cả/i,
        )
        .first(),
    ).toBeVisible({ timeout: 10_000 });
    await expectNoGlobalError(page);
  });
});
