import { expect, test, type Page, type Response } from "@playwright/test";

interface RuntimeConfig {
  schemaVersion: string;
  generatedAt: string;
  expiresAt: string;
  runtimeConfigUri: string;
  webUri: string;
  apiUri: string;
  auth: {
    issuerUri: string;
    callbackUri: string;
    logoutUri: string;
    clientId: string;
  };
  websocket: {
    notificationsUri: string;
    messagingUri: string;
  };
  providers: Array<{
    id: string;
    status: string;
    mode: string;
    reasonCode: string;
  }>;
}

const releaseContract = process.env.E2E_RELEASE_CONTRACT === "true";
const buyerUsername = process.env.E2E_BUYER_USERNAME ?? "";
const buyerPassword = process.env.E2E_BUYER_PASSWORD ?? "";
const expectedIssuer = process.env.E2E_CA_ISSUER ?? "vnshop-ci-root";

test.describe("staging release contract", () => {
  test.skip(!releaseContract, "enabled only by the staging promotion gate");

  test("proves TLS, runtime configuration, native API auth, and WebSockets", async ({
    context,
    page,
  }) => {
    expect(buyerUsername, "E2E_BUYER_USERNAME is required").not.toBe("");
    expect(buyerPassword, "E2E_BUYER_PASSWORD is required").not.toBe("");

    const webResponse = await page.goto("/runtime-config.json", { waitUntil: "domcontentloaded" });
    await expectTrustedTls(webResponse);
    const config = (await webResponse!.json()) as RuntimeConfig;
    expectRuntimeConfig(config);

    const discoveryPage = await context.newPage();
    const discoveryResponse = await discoveryPage.goto(
      `${config.auth.issuerUri}/.well-known/openid-configuration`,
      { waitUntil: "domcontentloaded" },
    );
    await expectTrustedTls(discoveryResponse);
    const discovery = (await discoveryResponse!.json()) as { issuer?: string };
    expect(discovery.issuer).toBe(config.auth.issuerUri);
    await discoveryPage.close();

    const websocketUrls = new Set<string>();
    page.on("websocket", (socket) => websocketUrls.add(socket.url()));

    await page.goto("/login");
    await page.locator("#username").fill(buyerUsername);
    await page.locator("#password").fill(buyerPassword);
    const loginResponsePromise = page.waitForResponse(
      (response) => response.url().endsWith("/auth/login") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: /sign in|continue to sign in/i }).click();
    const loginResponse = await loginResponsePromise;
    expect(loginResponse.ok(), `POST /auth/login returned ${loginResponse.status()}`).toBe(true);
    await page.waitForURL((url) => url.origin === new URL(config.webUri).origin, {
      timeout: 30_000,
    });

    const sessionCookies = await context.cookies();
    expect(
      sessionCookies.length,
      "native auth must establish at least one secure session cookie",
    ).toBeGreaterThan(0);
    for (const cookie of sessionCookies) {
      expect(cookie.secure, `${cookie.name} must be Secure`).toBe(true);
      expect(cookie.sameSite, `${cookie.name} must declare SameSite`).not.toBe("None");
    }

    const profileResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/users/me") && response.request().method() === "GET",
    );
    await page.goto("/profile");
    const profileResponse = await profileResponsePromise;
    expect(profileResponse.request().headers()["authorization"]).toMatch(/^Bearer ey/);
    expect(profileResponse.ok(), `GET /users/me returned ${profileResponse.status()}`).toBe(true);

    await expect
      .poll(() => [...websocketUrls], { timeout: 30_000 })
      .toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^wss:\/\/api\.vnshop\.invalid\/ws\/notifications\//),
          config.websocket.messagingUri,
        ]),
      );
  });
});

async function expectTrustedTls(response: Response | null): Promise<void> {
  expect(response, "HTTPS navigation must return a response").not.toBeNull();
  const details = await response!.securityDetails();
  expect(details, "HTTPS response must expose TLS security details").not.toBeNull();
  expect(details!.protocol).toMatch(/^TLS 1\.[23]$/);
  expect(details!.issuer.toLowerCase()).toContain(expectedIssuer.toLowerCase());
}

function expectRuntimeConfig(config: RuntimeConfig): void {
  expect(config.schemaVersion.split(".")[0]).toBe("1");
  expect(config.runtimeConfigUri).toBe("https://web.vnshop.invalid/runtime-config.json");
  expect(config.webUri).toBe("https://web.vnshop.invalid/");
  expect(config.apiUri).toBe("https://api.vnshop.invalid/");
  expect(config.auth.issuerUri).toBe("https://api.vnshop.invalid/realms/vnshop");
  expect(config.auth.callbackUri).toBe("https://web.vnshop.invalid/auth/callback");
  expect(config.auth.logoutUri).toBe("https://web.vnshop.invalid/");
  expect(config.websocket.notificationsUri).toBe("wss://api.vnshop.invalid/ws/notifications");
  expect(config.websocket.messagingUri).toBe("wss://api.vnshop.invalid/ws/messaging");
  expect(Date.parse(config.expiresAt) - Date.parse(config.generatedAt)).toBeLessThanOrEqual(
    300_000,
  );

  const providers = Object.fromEntries(config.providers.map((provider) => [provider.id, provider]));
  expect(Object.keys(providers).sort()).toEqual(
    ["cod", "momo", "paypal", "sepay", "stripe", "vietqr", "vnpay"].sort(),
  );
  expect(providers.cod).toMatchObject({ status: "enabled", mode: "stub" });
  expect(providers.vietqr).toMatchObject({ status: "enabled", mode: "demo" });
  for (const id of ["vnpay", "momo", "sepay"]) {
    expect(providers[id]).toMatchObject({ status: "disabled", mode: "disabled" });
  }
  for (const id of ["stripe", "paypal"]) {
    expect(["disabled", "enabled"]).toContain(providers[id].status);
    expect(["disabled", "sandbox"]).toContain(providers[id].mode);
  }
  for (const provider of config.providers) {
    expect(provider.reasonCode).not.toBe("");
  }
}
