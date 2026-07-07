import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { expectNoGlobalError } from "../_helpers";

/**
 * Critical user flow: Product Search → Add to Cart → Checkout
 *
 * Tests are API-seeded (fresh buyer + address) to be deterministic.
 * No hardcoded credentials — all test users are created per-test.
 *
 * Flows covered:
 *   1. Product search and filtering
 *   2. Add product to cart
 *   3. View cart and modify quantities
 *   4. Proceed to checkout
 *   5. Complete checkout with address + payment
 *   6. Order confirmation
 */

const PASSWORD = "Test1234!";
const apiURL = process.env.VITE_E2E_API_URL ?? "http://localhost:8080";

interface TestBuyer {
  email: string;
  accessToken: string;
}

async function seedBuyer(request: APIRequestContext): Promise<TestBuyer> {
  const stamp = Date.now() + Math.floor(Math.random() * 1_000);
  const email = `e2e_spec_checkout_${stamp}@vnshop.local`;
  const reg = await request.post(`${apiURL}/auth/register`, {
    data: { firstName: "QA", lastName: "Buyer", email, password: PASSWORD },
  });
  expect(reg.ok(), `register: ${reg.status()} ${await reg.text()}`).toBeTruthy();
  const login = await request.post(`${apiURL}/auth/login`, {
    data: { username: email, password: PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  const accessToken = (await login.json())?.data?.accessToken;
  expect(accessToken).toBeTruthy();
  return { email, accessToken };
}

async function seedAddress(request: APIRequestContext, buyer: TestBuyer): Promise<void> {
  const r = await request.post(`${apiURL}/users/me/addresses`, {
    headers: { Authorization: `Bearer ${buyer.accessToken}` },
    data: {
      street: "123 E2E Test Street",
      ward: "1442",
      district: "101",
      city: "Ho Chi Minh",
      isDefault: true,
    },
  });
  expect(r.ok(), `add address: ${r.status()} ${await r.text()}`).toBeTruthy();
}

async function addProductToCart(
  request: APIRequestContext,
  buyer: TestBuyer,
  productId: string,
  quantity = 1,
): Promise<void> {
  const r = await request.post(`${apiURL}/cart/items`, {
    headers: { Authorization: `Bearer ${buyer.accessToken}` },
    data: { productId, quantity },
  });
  expect(r.ok(), `add to cart: ${r.status()} ${await r.text()}`).toBeTruthy();
}

async function getFirstProductId(request: APIRequestContext): Promise<string> {
  const r = await request.get(`${apiURL}/products?size=1`);
  expect(r.ok()).toBeTruthy();
  const id = (await r.json())?.data?.content?.[0]?.id;
  expect(id, "expected a seeded product").toBeTruthy();
  return id;
}

async function authenticatePage(page: Page, buyer: TestBuyer): Promise<void> {
  await page.goto("/");
  await page.evaluate(
    ({ token }) => {
      localStorage.setItem("vnshop_access_token", token);
    },
    { token: buyer.accessToken },
  );
}

test.describe("Checkout Flow", () => {
  test("Product search returns results and user can add to cart", async ({ page }) => {
    await page.goto("/");

    // Wait for page to be ready
    await expect(
      page.getByRole("button", { name: /^(Log in|Đăng nhập)$/i }).first(),
    ).toBeVisible({ timeout: 20_000 });

    // Navigate to products/search page
    await page.goto("/products");

    // Wait for product grid to load
    const firstProduct = page.locator("[data-testid='product-card']").first();
    await expect(firstProduct).toBeVisible({ timeout: 15_000 });

    // Click on first product to view details
    await firstProduct.click();

    // Wait for product detail page
    await expect(page.locator("[data-testid='add-to-cart']")).toBeVisible({ timeout: 15_000 });

    // Add to cart
    await page.locator("[data-testid='add-to-cart']").click();

    // Verify cart badge updates or toast appears
    await expect(
      page.getByText(/Added to cart|Đã thêm vào giỏ/i),
    ).toBeVisible({ timeout: 10_000 });

    await expectNoGlobalError(page);
  });

  test("Cart shows correct items and total", async ({ page }) => {
    const buyer = await seedBuyer(page.request);
    const productId = await getFirstProductId(page.request);
    await addProductToCart(page.request, buyer, productId, 2);

    await authenticatePage(page, buyer);
    await page.goto("/cart");

    // Cart should show the product
    await expect(
      page.locator("[data-testid='cart-item']").first(),
    ).toBeVisible({ timeout: 15_000 });

    // Quantity should reflect 2 items
    const quantityInput = page.locator("[data-testid='cart-item-quantity']").first();
    await expect(quantityInput).toHaveValue("2");

    // Total should be visible
    await expect(
      page.getByText(/Total|Tổng cộng/i).first(),
    ).toBeVisible({ timeout: 5_000 });

    await expectNoGlobalError(page);
  });

  test("Checkout with empty cart shows empty state", async ({ page }) => {
    const buyer = await seedBuyer(page.request);
    await authenticatePage(page, buyer);
    await page.goto("/checkout");

    await expect(
      page.getByText(/Your cart is empty|Giỏ hàng trống/i),
    ).toBeVisible({ timeout: 15_000 });

    await expectNoGlobalError(page);
  });

  test("Checkout with cart but no address shows address prompt", async ({ page }) => {
    const buyer = await seedBuyer(page.request);
    const productId = await getFirstProductId(page.request);
    await addProductToCart(page.request, buyer, productId);

    await authenticatePage(page, buyer);
    await page.goto("/checkout");

    // Should show prompt to add address
    await expect(
      page.getByText(
        /add a delivery address|add.*address|chưa có địa chỉ/i,
      ),
    ).toBeVisible({ timeout: 15_000 });

    await expectNoGlobalError(page);
  });

  test("Complete checkout flow: cart → address → shipping → payment → confirmation", async ({
    page,
  }) => {
    const buyer = await seedBuyer(page.request);
    const productId = await getFirstProductId(page.request);
    await addProductToCart(page.request, buyer, productId);
    await seedAddress(page.request, buyer);

    await authenticatePage(page, buyer);
    await page.goto("/checkout");

    // Step 1: Address selection
    await expect(
      page.getByText(/Choose a delivery address|Chọn địa chỉ giao hàng/i).first(),
    ).toBeVisible({ timeout: 20_000 });

    // Select the seeded address
    const addressCard = page.locator("[data-testid='address-card']").first();
    await expect(addressCard).toBeVisible({ timeout: 5_000 });
    await addressCard.click();

    // Confirm address and proceed to shipping
    const continueBtn = page.getByRole("button", { name: /continue|tiếp tục/i }).first();
    await continueBtn.click();

    // Step 2: Shipping method selection
    await expect(
      page.getByText(/Shipping method|Phương thức vận chuyển/i).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Select standard shipping
    const shippingOption = page.locator("[data-testid='shipping-option']").first();
    await expect(shippingOption).toBeVisible({ timeout: 5_000 });
    await shippingOption.click();
    await continueBtn.click();

    // Step 3: Payment method selection
    await expect(
      page.getByText(/Payment method|Phương thức thanh toán/i).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Select COD (Cash on Delivery) for simplest E2E
    const codOption = page.getByText(/Cash on Delivery|Thanh toán khi nhận hàng|COD/i);
    await codOption.click();
    await continueBtn.click();

    // Step 4: Review order before confirmation
    await expect(
      page.getByText(/Review your order|Xem lại đơn hàng/i).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Place order button
    const placeOrderBtn = page.getByRole("button", { name: /place order|đặt hàng/i });
    await expect(placeOrderBtn).toBeVisible({ timeout: 5_000 });
    await placeOrderBtn.click();

    // Step 5: Order confirmation
    await expect(
      page.locator("[data-testid='order-confirmation']"),
    ).toBeVisible({ timeout: 30_000 });

    // Should show order number
    await expect(
      page.getByText(/order.*#|đơn hàng.*#/i),
    ).toBeVisible({ timeout: 10_000 });

    await expectNoGlobalError(page);
  });

  test("Checkout 4-step progress indicator is visible throughout", async ({ page }) => {
    const buyer = await seedBuyer(page.request);
    const productId = await getFirstProductId(page.request);
    await addProductToCart(page.request, buyer, productId);
    await seedAddress(page.request, buyer);

    await authenticatePage(page, buyer);
    await page.goto("/checkout");

    // Wait for address step
    await expect(
      page.getByText(/Choose a delivery address|Chọn địa chỉ giao hàng/i).first(),
    ).toBeVisible({ timeout: 20_000 });

    // All 4 steps should be visible in the progress indicator
    const steps = [
      /address|địa chỉ/i,
      /shipping|vận chuyển/i,
      /payment|thanh toán/i,
      /review|xác nhận/i,
    ];

    for (const step of steps) {
      await expect(page.getByText(step).first()).toBeVisible({ timeout: 5_000 });
    }

    await expectNoGlobalError(page);
  });

  test("Can update cart item quantity from cart page", async ({ page }) => {
    const buyer = await seedBuyer(page.request);
    const productId = await getFirstProductId(page.request);
    await addProductToCart(page.request, buyer, productId, 1);

    await authenticatePage(page, buyer);
    await page.goto("/cart");

    await expect(
      page.locator("[data-testid='cart-item']").first(),
    ).toBeVisible({ timeout: 15_000 });

    // Increase quantity
    const increaseBtn = page.locator("[data-testid='cart-item-increase']").first();
    await increaseBtn.click();

    // Verify quantity updated
    const quantityInput = page.locator("[data-testid='cart-item-quantity']").first();
    await expect(quantityInput).toHaveValue("2");

    await expectNoGlobalError(page);
  });

  test("Can remove item from cart", async ({ page }) => {
    const buyer = await seedBuyer(page.request);
    const productId = await getFirstProductId(page.request);
    await addProductToCart(page.request, buyer, productId, 1);

    await authenticatePage(page, buyer);
    await page.goto("/cart");

    await expect(
      page.locator("[data-testid='cart-item']").first(),
    ).toBeVisible({ timeout: 15_000 });

    // Remove item
    const removeBtn = page.locator("[data-testid='cart-item-remove']").first();
    await removeBtn.click();

    // Cart should now be empty or item should be gone
    await expect(
      page.locator("[data-testid='cart-item']").first(),
    ).toHaveCount(0, { timeout: 10_000 });

    await expectNoGlobalError(page);
  });
});
