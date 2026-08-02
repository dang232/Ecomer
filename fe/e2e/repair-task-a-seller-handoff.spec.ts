import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test";

import { credentialForPersona } from "./modernization/_credentials";

const apiURL = (process.env.VITE_E2E_API_URL ?? "http://localhost:8080").replace(/\/$/, "");
const uiURL = process.env.VITE_E2E_BASE_URL ?? "http://localhost:3000";
const PASSWORD = "Test1234!";

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  errorCode?: string | null;
}

interface LoginData {
  accessToken: string;
}

interface RegistrationData {
  email: string;
  userId: string;
}

interface JwtClaims {
  sub: string;
  realm_access?: { roles?: string[] };
}

interface SellerProfile {
  id: string;
  shopName: string;
  bankName?: string | null;
  approved: boolean;
}

interface PublicSellerPage {
  content?: SellerProfile[];
}

async function readEnvelope<T>(
  response: Awaited<ReturnType<APIRequestContext["get"]>>,
): Promise<ApiEnvelope<T>> {
  const raw = await response.text();
  let body: ApiEnvelope<T>;
  try {
    body = JSON.parse(raw) as ApiEnvelope<T>;
  } catch {
    throw new Error(`Expected JSON from ${response.url()} (${response.status()}): ${raw}`);
  }
  expect(response.ok(), `${response.url()} returned ${response.status()}: ${raw}`).toBeTruthy();
  expect(body.success, `${response.url()} returned an unsuccessful envelope: ${raw}`).toBe(true);
  return body;
}

async function postEnvelope<T>(
  request: APIRequestContext,
  path: string,
  options: Parameters<APIRequestContext["post"]>[1],
): Promise<ApiEnvelope<T>> {
  return readEnvelope(await request.post(`${apiURL}${path}`, options));
}

function decodeJwt(token: string): JwtClaims {
  const payload = token.split(".")[1];
  if (!payload) throw new Error("Access token has no JWT payload");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as JwtClaims;
}

async function login(
  request: APIRequestContext,
  username: string,
  password: string,
): Promise<LoginData> {
  const response = await request.post(`${apiURL}/auth/login`, {
    data: { username, password },
    failOnStatusCode: false,
  });
  const body = await readEnvelope<LoginData>(response);
  expect(body.data.accessToken).toEqual(expect.any(String));
  return body.data;
}

function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

test.describe.serial("Repair Task A applicant seller handoff", () => {
  test.setTimeout(180_000);

  test("fresh buyer becomes the approved seller without a second application", async ({
    browser,
    playwright,
  }) => {
    const buyerRequest = await playwright.request.newContext();
    const adminRequest = await playwright.request.newContext();
    let buyerBrowser: BrowserContext | undefined;

    try {
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const email = `repair-task-a-${unique}@vnshop.local`;
      const shopName = `Repair Task A Shop ${unique}`;

      const registration = await postEnvelope<RegistrationData>(buyerRequest, "/auth/register", {
        data: {
          email,
          password: PASSWORD,
          firstName: "Repair",
          lastName: "Applicant",
        },
        failOnStatusCode: false,
      });
      expect(registration.data.email).toBe(email);
      expect(registration.data.userId).toEqual(expect.any(String));

      const buyerLogin = await login(buyerRequest, email, PASSWORD);
      const buyerBeforeApproval = decodeJwt(buyerLogin.accessToken);
      expect(buyerBeforeApproval.sub).toEqual(expect.any(String));

      const applicationResponse = await postEnvelope<SellerProfile>(
        buyerRequest,
        "/sellers/register",
        {
          data: { shopName, bankName: "Vietcombank" },
          headers: bearer(buyerLogin.accessToken),
        },
      );
      const application = applicationResponse.data;
      expect(application.id).toBe(buyerBeforeApproval.sub);
      expect(application.shopName).toBe(shopName);
      expect(application.approved).toBe(false);

      const adminCredentials = credentialForPersona("admin");
      const adminLogin = await login(
        adminRequest,
        adminCredentials.username,
        adminCredentials.password,
      );
      const pendingResponse = await adminRequest.get(`${apiURL}/admin/sellers`, {
        headers: bearer(adminLogin.accessToken),
        failOnStatusCode: false,
      });
      const pendingBody = await readEnvelope<SellerProfile[]>(pendingResponse);
      expect(pendingBody.data.some((seller) => seller.id === buyerBeforeApproval.sub)).toBe(true);

      const approvalResponse = await postEnvelope<SellerProfile>(
        adminRequest,
        `/admin/sellers/${encodeURIComponent(application.id)}/approve`,
        { headers: bearer(adminLogin.accessToken) },
      );
      expect(approvalResponse.data.id).toBe(buyerBeforeApproval.sub);
      expect(approvalResponse.data.approved).toBe(true);

      const stateBeforeRefresh = await buyerRequest.storageState();
      const csrfCookie = stateBeforeRefresh.cookies.find((cookie) => cookie.name === "vnshop_csrf");
      expect(csrfCookie?.value, "login should set the refresh CSRF cookie").toEqual(
        expect.any(String),
      );

      const refreshedResponse = await postEnvelope<LoginData>(buyerRequest, "/auth/refresh", {
        headers: { "X-CSRF-Token": csrfCookie?.value ?? "" },
      });
      const buyerAfterApproval = decodeJwt(refreshedResponse.data.accessToken);
      expect(buyerAfterApproval.sub).toBe(buyerBeforeApproval.sub);
      expect(buyerAfterApproval.realm_access?.roles).toContain("SELLER");

      const publicSellersResponse = await buyerRequest.get(`${apiURL}/sellers?page=0&size=100`, {
        failOnStatusCode: false,
      });
      const publicSellers = await readEnvelope<PublicSellerPage>(publicSellersResponse);
      expect(
        publicSellers.data.content?.some(
          (seller) => seller.id === buyerBeforeApproval.sub && seller.shopName === shopName,
        ),
      ).toBe(true);

      buyerBrowser = await browser.newContext({
        baseURL: uiURL,
        storageState: await buyerRequest.storageState(),
      });
      const page = await buyerBrowser.newPage();

      await page.goto("/seller");
      await expect(page.getByTestId("seller-dashboard")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("heading", { name: shopName, exact: true })).toBeVisible();

      await page.goto("/seller/register");
      await expect(page.getByText(shopName, { exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(page.locator("#seller-shop-name")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: /submit application|gửi đăng ký/i }),
      ).toHaveCount(0);
    } finally {
      await buyerBrowser?.close();
      await buyerRequest.dispose();
      await adminRequest.dispose();
    }
  });
});
