# VNShop Checkout And Type Boundaries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove that checkout creates at most one order per attempt and remove the known unsafe network and cart-data type boundaries before visual refactoring.

**Architecture:** The replacement checkout plan owns a durable controller that
separates order placement, read-only ambiguity reconciliation, and
payment-only retries. Shared JSON/Zod helpers convert untrusted values to typed
data, while schemas rather than casts define auth, health, envelope, cart, and
payment-method boundaries.

**Tech Stack:** React 19, TypeScript strict mode, Zod 4, TanStack Query 5, Vitest 4, Testing Library.

## Execution Notice

Tasks 1-2 in this file are retained only as review history and **must not be
executed**. They were superseded after independent contract and concurrency
review by
`2026-07-29-web-commerce-modernization-02a-checkout-lifecycle.md`.
Execute that replacement plan first, then resume this file at Task 3. The
replacement removes the render-captured runner race, reconciles ambiguous
placement without resubmission, isolates cart changes, removes unsupported
`BANK`, fails closed to server-advertised payment capabilities, and fixes
redirect return identity.

## Global Constraints

- Preserve current order, coupon, shipping, provider, and payment-return semantics.
- Once an order ID exists, a retry must not call `POST /orders`.
- Use one order idempotency key for the initial placement call. If its outcome
  is ambiguous, reconcile through the buyer-owned lookup and do not resubmit.
- Create one payment idempotency key after order creation and reuse it for payment retries.
- Keep COD confirmation best-effort and keep Stripe, PayPal, and VietQR inline flows on the existing order.
- Keep unavailable payment methods out of the selectable list.
- Parse persisted state and network values from `unknown`; do not cast them into trusted types.
- Use discriminated unions and exhaustive switching for checkout states.
- Run the master plan Review Gate after every task.
- Do not stage or commit `fe/.ua/`.

---

### Task 1: Model The One-Order Checkout State Machine

**Files:**
- Create: `fe/src/features/checkout/model/submission.ts`
- Create: `fe/src/features/checkout/model/submission.test.ts`
- Create: `fe/src/features/checkout/index.ts`

**Interfaces:**
- Consumes: `PaymentMethod` from `fe/src/app/lib/domain-enums.ts` until Plan 03 moves canonical domain values to shared contracts.
- Produces: `CheckoutSubmissionState`, `CheckoutSubmissionEvent`, `createCheckoutDraft`, `checkoutSubmissionReducer`, and `resetForCartChange`.

- [ ] **Step 1: Write the failing state-transition tests**

Create `fe/src/features/checkout/model/submission.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  checkoutSubmissionReducer,
  createCheckoutDraft,
  resetForCartChange,
} from "./submission";

describe("checkoutSubmissionReducer", () => {
  it("retains order and payment keys when payment initialization fails", () => {
    const created = checkoutSubmissionReducer(
      { status: "placing", orderKey: "order-key" },
      {
        type: "order-created",
        orderId: "order-1",
        total: 125_000,
        provider: "VNPAY",
        paymentKey: "payment-key",
      },
    );
    const initializing = checkoutSubmissionReducer(created, {
      type: "initialize-payment",
    });
    const failed = checkoutSubmissionReducer(initializing, {
      type: "payment-failed",
      message: "gateway unavailable",
    });

    expect(failed).toEqual({
      status: "failed",
      stage: "payment",
      message: "gateway unavailable",
      orderKey: "order-key",
      paymentKey: "payment-key",
      orderId: "order-1",
      total: 125_000,
      provider: "VNPAY",
    });
  });

  it("does not reset a state that already owns an order", () => {
    const state = {
      status: "failed",
      stage: "payment",
      message: "retry",
      orderKey: "order-key",
      paymentKey: "payment-key",
      orderId: "order-1",
      total: 125_000,
      provider: "VNPAY",
    } as const;

    expect(resetForCartChange(state, "new-order-key")).toBe(state);
  });

  it("does not reset an order request already in flight", () => {
    const placing = checkoutSubmissionReducer(createCheckoutDraft("order-key"), {
      type: "place",
      provider: "COD",
    });

    expect(resetForCartChange(placing, "new-order-key")).toBe(placing);
  });

  it("uses a fresh order key when the cart changes before order creation", () => {
    expect(resetForCartChange(createCheckoutDraft("old-key"), "new-key")).toEqual({
      status: "draft",
      orderKey: "new-key",
    });
  });
});
```

- [ ] **Step 2: Run the test and confirm the missing model**

Run: `pnpm exec vitest run src/features/checkout/model/submission.test.ts`

Working directory: `fe`

Expected: FAIL because `submission.ts` does not exist.

- [ ] **Step 3: Implement the discriminated union and reducer**

Create `fe/src/features/checkout/model/submission.ts`:

```ts
import type { PaymentMethod } from "@/app/lib/domain-enums";

interface CreatedOrder {
  orderKey: string;
  paymentKey: string;
  orderId: string;
  total: number;
  provider: PaymentMethod;
}

export type CheckoutSubmissionState =
  | { status: "draft"; orderKey: string }
  | { status: "placing"; orderKey: string }
  | ({ status: "order-created" } & CreatedOrder)
  | ({ status: "payment-initializing" } & CreatedOrder)
  | ({ status: "pending" } & CreatedOrder)
  | { status: "completed"; orderId: string; total: number; provider: PaymentMethod }
  | {
      status: "failed";
      stage: "order";
      message: string;
      orderKey: string;
      provider: PaymentMethod;
    }
  | ({
      status: "failed";
      stage: "payment";
      message: string;
    } & CreatedOrder);

export type CheckoutSubmissionEvent =
  | { type: "place"; provider: PaymentMethod }
  | ({
      type: "order-created";
    } & Omit<CreatedOrder, "orderKey">)
  | { type: "initialize-payment" }
  | { type: "payment-pending" }
  | { type: "payment-completed" }
  | { type: "order-failed"; provider: PaymentMethod; message: string }
  | { type: "payment-failed"; message: string };

export const createCheckoutDraft = (orderKey: string): CheckoutSubmissionState => ({
  status: "draft",
  orderKey,
});

export function checkoutSubmissionReducer(
  state: CheckoutSubmissionState,
  event: CheckoutSubmissionEvent,
): CheckoutSubmissionState {
  switch (event.type) {
    case "place":
      if (state.status !== "draft" && !(state.status === "failed" && state.stage === "order")) {
        return state;
      }
      return { status: "placing", orderKey: state.orderKey };
    case "order-created":
      if (state.status !== "placing") return state;
      return {
        status: "order-created",
        orderKey: state.orderKey,
        paymentKey: event.paymentKey,
        orderId: event.orderId,
        total: event.total,
        provider: event.provider,
      };
    case "initialize-payment":
      if (state.status !== "order-created" && !(state.status === "failed" && state.stage === "payment")) {
        return state;
      }
      return {
        status: "payment-initializing",
        orderKey: state.orderKey,
        paymentKey: state.paymentKey,
        orderId: state.orderId,
        total: state.total,
        provider: state.provider,
      };
    case "payment-pending":
    case "payment-completed":
      if (state.status !== "payment-initializing") return state;
      if (event.type === "payment-pending") {
        return { ...state, status: "pending" };
      }
      return {
        status: "completed",
        orderId: state.orderId,
        total: state.total,
        provider: state.provider,
      };
    case "order-failed":
      if (state.status !== "placing") return state;
      return {
        status: "failed",
        stage: "order",
        message: event.message,
        orderKey: state.orderKey,
        provider: event.provider,
      };
    case "payment-failed":
      if (state.status !== "payment-initializing") return state;
      return { ...state, status: "failed", stage: "payment", message: event.message };
  }
}

export function resetForCartChange(
  state: CheckoutSubmissionState,
  newOrderKey: string,
): CheckoutSubmissionState {
  if (
    state.status === "placing" ||
    state.status === "order-created" ||
    state.status === "payment-initializing" ||
    state.status === "pending" ||
    state.status === "completed" ||
    (state.status === "failed" && state.stage === "payment")
  ) {
    return state;
  }
  return createCheckoutDraft(newOrderKey);
}
```

Create `fe/src/features/checkout/index.ts`:

```ts
export {
  checkoutSubmissionReducer,
  createCheckoutDraft,
  resetForCartChange,
  type CheckoutSubmissionEvent,
  type CheckoutSubmissionState,
} from "./model/submission";
```

- [ ] **Step 4: Run model tests and type safety**

Run from `fe`:

```powershell
pnpm exec vitest run src/features/checkout/model/submission.test.ts
pnpm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Review and commit**

Use the master Review Gate, then commit:

```powershell
# Historical task only; if replayed for archaeology, stage exact Files entries.
Add-ReviewedTaskFiles -Paths $taskFiles
git commit -m "feat(fe): model checkout submission states"
```

### Task 2: Separate Order Placement From Payment Retry

**Files:**
- Create: `fe/src/features/checkout/model/run-submission.ts`
- Create: `fe/src/features/checkout/model/run-submission.test.ts`
- Modify: `fe/src/features/checkout/index.ts`
- Modify: `fe/src/app/pages/checkout/CheckoutPage.tsx`
- Modify: `fe/src/app/pages/checkout/CheckoutReviewStep.tsx`
- Create: `fe/src/app/pages/checkout/CheckoutPaymentRecovery.tsx`
- Test: `fe/src/app/pages/checkout/CheckoutPage.test.tsx`
- Modify: `fe/src/app/lib/i18n/en.json`
- Modify: `fe/src/app/lib/i18n/vi.json`

**Interfaces:**
- Consumes: `CheckoutSubmissionState` and reducer events from Task 1; existing `placeOrder`, `codConfirm`, `vnpayCreate`, and `momoCreate`.
- Produces: `runCheckoutSubmission(input, state, dependencies)` and a payment-only retry action for an existing order.

- [ ] **Step 1: Write the failing one-order invariant tests**

Create `fe/src/features/checkout/model/run-submission.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import { createCheckoutDraft } from "./submission";
import { runCheckoutSubmission } from "./run-submission";

const input = {
  order: {
    items: [{ productId: "product-1", quantity: 1 }],
    shippingAddress: { street: "1 Main", district: "D1", city: "HCM" },
    paymentMethod: "VNPAY",
  },
  provider: "VNPAY",
} as const;

describe("runCheckoutSubmission", () => {
  it("places one order and retries only payment after initialization failure", async () => {
    const placeOrder = vi.fn().mockResolvedValue({ id: "order-1", total: 125_000 });
    const initializeRedirect = vi
      .fn()
      .mockRejectedValueOnce(new Error("gateway unavailable"))
      .mockResolvedValueOnce({ redirectUrl: "https://payments.example/continue" });
    const dependencies = {
      placeOrder,
      confirmCod: vi.fn(),
      initializeRedirect,
      newKey: vi.fn().mockReturnValue("payment-key"),
    };

    const first = await runCheckoutSubmission(input, createCheckoutDraft("order-key"), dependencies);
    expect(first.state).toMatchObject({
      status: "failed",
      stage: "payment",
      orderId: "order-1",
      paymentKey: "payment-key",
    });

    const second = await runCheckoutSubmission(input, first.state, dependencies);
    expect(second.redirectUrl).toBe("https://payments.example/continue");
    expect(placeOrder).toHaveBeenCalledTimes(1);
    expect(initializeRedirect).toHaveBeenCalledTimes(2);
    expect(initializeRedirect).toHaveBeenNthCalledWith(
      2,
      "VNPAY",
      "order-1",
      "payment-key",
    );
  });

  it("retries a failed order with the original order key", async () => {
    const placeOrder = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ id: "order-1", total: 125_000 });
    const dependencies = {
      placeOrder,
      confirmCod: vi.fn(),
      initializeRedirect: vi.fn().mockResolvedValue({ redirectUrl: null }),
      newKey: vi.fn().mockReturnValue("payment-key"),
    };

    const first = await runCheckoutSubmission(input, createCheckoutDraft("order-key"), dependencies);
    const second = await runCheckoutSubmission(input, first.state, dependencies);

    expect(second.state).toMatchObject({ orderId: "order-1" });
    expect(placeOrder).toHaveBeenNthCalledWith(1, input.order, "order-key");
    expect(placeOrder).toHaveBeenNthCalledWith(2, input.order, "order-key");
  });
});
```

- [ ] **Step 2: Run the tests and verify the runner is missing**

Run: `pnpm exec vitest run src/features/checkout/model/run-submission.test.ts`

Working directory: `fe`

Expected: FAIL because `run-submission.ts` does not exist.

- [ ] **Step 3: Implement the orchestration runner**

Create `fe/src/features/checkout/model/run-submission.ts`:

```ts
import type { PaymentMethod } from "@/app/lib/domain-enums";
import type { PlaceOrderInput } from "@/app/lib/api/endpoints/orders";

import {
  checkoutSubmissionReducer,
  type CheckoutSubmissionState,
} from "./submission";

interface Dependencies {
  placeOrder: (input: PlaceOrderInput, key: string) => Promise<{ id: string; total: number }>;
  confirmCod: (orderId: string, key: string) => Promise<unknown>;
  initializeRedirect: (
    provider: "VNPAY" | "MOMO",
    orderId: string,
    key: string,
  ) => Promise<{ redirectUrl: string | null }>;
  newKey: () => string;
  onTransition?: (state: CheckoutSubmissionState) => void;
}

interface SubmissionInput {
  order: PlaceOrderInput;
  provider: PaymentMethod;
}

interface SubmissionResult {
  state: CheckoutSubmissionState;
  redirectUrl?: string;
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : "Unknown error");

export async function runCheckoutSubmission(
  input: SubmissionInput,
  initial: CheckoutSubmissionState,
  dependencies: Dependencies,
): Promise<SubmissionResult> {
  let state = initial;
  const transition = (event: Parameters<typeof checkoutSubmissionReducer>[1]) => {
    state = checkoutSubmissionReducer(state, event);
    dependencies.onTransition?.(state);
  };

  if (state.status === "draft" || (state.status === "failed" && state.stage === "order")) {
    transition({ type: "place", provider: input.provider });
    try {
      const order = await dependencies.placeOrder(input.order, state.orderKey);
      transition({
        type: "order-created",
        orderId: order.id,
        total: order.total,
        provider: input.provider,
        paymentKey: dependencies.newKey(),
      });
    } catch (error: unknown) {
      transition({
        type: "order-failed",
        provider: input.provider,
        message: messageOf(error),
      });
      return {
        state,
      };
    }
  }

  if (state.status === "failed" && state.stage === "payment") {
    transition({ type: "initialize-payment" });
  } else if (state.status === "order-created") {
    transition({ type: "initialize-payment" });
  } else {
    return { state };
  }

  if (state.status !== "payment-initializing") return { state };

  if (state.provider === "STRIPE" || state.provider === "PAYPAL" || state.provider === "VIETQR") {
    transition({ type: "payment-pending" });
    return { state };
  }

  if (state.provider === "BANK") {
    transition({ type: "payment-completed" });
    return { state };
  }

  if (state.provider === "COD") {
    try {
      await dependencies.confirmCod(state.orderId, state.paymentKey);
    } catch {
      transition({ type: "payment-pending" });
      return { state };
    }
    transition({ type: "payment-completed" });
    return { state };
  }

  try {
    const result = await dependencies.initializeRedirect(
      state.provider,
      state.orderId,
      state.paymentKey,
    );
    if (!result.redirectUrl) throw new Error("Payment provider returned no redirect URL");
    return { state, redirectUrl: result.redirectUrl };
  } catch (error: unknown) {
    transition({
      type: "payment-failed",
      message: messageOf(error),
    });
    return {
      state,
    };
  }
}
```

Export `runCheckoutSubmission` from `fe/src/features/checkout/index.ts`.

- [ ] **Step 4: Integrate the runner into CheckoutPage**

Replace `isProcessing`, `placedOrderId`, `placedOrderTotal`, `paymentInFlightRef`, and the mutable idempotency ref with:

```ts
const [submission, setSubmission] = useState<CheckoutSubmissionState>(() =>
  createCheckoutDraft(crypto.randomUUID()),
);
const isProcessing =
  submission.status === "placing" || submission.status === "payment-initializing";
const placedOrderId = "orderId" in submission ? submission.orderId : null;
const placedOrderTotal = "total" in submission ? submission.total : null;
```

Derive a stable cart fingerprint from sorted `productId`, `variantId`, and quantity values so query-cache array identity changes do not rotate the order key. On semantic cart changes:

```ts
const cartFingerprint = cartItems
  .map((item) => `${item.productId}:${item.variantId ?? ""}:${item.quantity}`)
  .sort()
  .join("|");

useEffect(() => {
  setSubmission((current) => resetForCartChange(current, crypto.randomUUID()));
}, [cartFingerprint]);
```

Build dependencies once in `handlePlaceOrder`:

```ts
const result = await runCheckoutSubmission(
  { order: orderInput, provider: selectedPaymentId },
  submission,
  {
    placeOrder,
    confirmCod: (orderId, key) => codConfirm({ orderId }, key),
    initializeRedirect: (provider, orderId, key) =>
      provider === "VNPAY"
        ? vnpayCreate({ orderId, returnUrl: `${location.origin}/payment/return/vnpay` }, key)
        : momoCreate({ orderId, returnUrl: `${location.origin}/payment/return/momo` }, key),
    newKey: () => crypto.randomUUID(),
    onTransition: setSubmission,
  },
);
setSubmission(result.state);
if (result.redirectUrl) {
  location.assign(result.redirectUrl);
  return;
}
if (result.state.status === "pending" || result.state.status === "completed") {
  void refetchCart();
  setStep("success");
}
```

The payment retry button calls the same handler while `submission.status === "failed" && submission.stage === "payment"`; `runCheckoutSubmission` skips order placement.

- [ ] **Step 5: Add explicit payment recovery UI**

Create `fe/src/app/pages/checkout/CheckoutPaymentRecovery.tsx`:

```tsx
import { AlertCircle, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/shared/ui/button";

interface CheckoutPaymentRecoveryProps {
  orderId: string;
  message: string;
  pending: boolean;
  onRetry: () => void;
  onViewOrder: () => void;
}

export function CheckoutPaymentRecovery(props: CheckoutPaymentRecoveryProps) {
  const { t } = useTranslation();
  return (
    <section role="alert" className="border border-warning p-4">
      <div className="flex items-start gap-3">
        <AlertCircle aria-hidden="true" className="shrink-0 text-warning" />
        <div>
          <h2 className="font-semibold">{t("checkout.payment.orderCreatedPaymentFailed")}</h2>
          <p className="text-sm text-muted-foreground">{props.message}</p>
          <p className="text-sm">{t("checkout.payment.existingOrder", { id: props.orderId })}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={props.onRetry} disabled={props.pending}>
          <RotateCcw aria-hidden="true" />
          {t("checkout.payment.retryPayment")}
        </Button>
        <Button variant="outline" onClick={props.onViewOrder}>
          {t("checkout.payment.viewOrder")}
        </Button>
      </div>
    </section>
  );
}
```

Add matching English and Vietnamese keys for the four strings. Render this component instead of the review submit controls when payment failed after order creation.

- [ ] **Step 6: Add page-level regression coverage**

Create `fe/src/app/pages/checkout/CheckoutPage.test.tsx` using the existing auth/cart/query test providers. Mock `placeOrder` to succeed and `vnpayCreate` to fail then succeed. Assert:

```ts
expect(await screen.findByText(/order was created/i)).toBeVisible();
await user.click(screen.getByRole("button", { name: /retry payment/i }));
await waitFor(() => expect(vnpayCreate).toHaveBeenCalledTimes(2));
expect(placeOrder).toHaveBeenCalledTimes(1);
expect(placeOrder).toHaveBeenCalledWith(expect.any(Object), expect.any(String));
```

Also assert the retry control is disabled while the second payment request is pending.

- [ ] **Step 7: Verify checkout behavior**

Run from `fe`:

```powershell
pnpm exec vitest run src/features/checkout/model/submission.test.ts src/features/checkout/model/run-submission.test.ts src/app/pages/checkout/CheckoutPage.test.tsx
pnpm run typecheck
pnpm run lint:changed -- --base $env:LINT_BASE_SHA
```

Expected: PASS, and the invariant test reports one `placeOrder` call after two payment attempts.

- [ ] **Step 8: Review and commit**

Use the master Review Gate, then commit:

```powershell
# Historical task only; if replayed for archaeology, stage exact Files entries.
Add-ReviewedTaskFiles -Paths $taskFiles
git commit -m "fix(fe): prevent duplicate checkout orders"
```

### Task 3: Decode Network, Session, And Local-Storage Values

**Files:**
- Create: `fe/src/shared/api/read-json.ts`
- Create: `fe/src/shared/api/read-json.test.ts`
- Modify: `fe/src/app/lib/api/envelope.ts`
- Modify: `fe/src/app/lib/api/envelope.test.ts`
- Modify: `fe/src/app/lib/auth/native-auth.ts`
- Test: `fe/src/app/lib/auth/native-auth.test.ts`
- Modify: `fe/src/app/lib/api/endpoints/auth.test.ts`
- Modify: `fe/src/app/hooks/use-app-config.ts`
- Modify: `fe/src/app/hooks/use-cart.ts`
- Modify: `fe/src/app/hooks/use-products-v2.ts`
- Create: `fe/src/app/hooks/use-recently-viewed.test.ts`
- Modify: `fe/src/app/hooks/use-recently-viewed.ts`
- Modify: `fe/src/app/hooks/use-search-v2.ts`
- Modify: `fe/src/app/hooks/use-wishlist.ts`
- Modify: `fe/src/app/lib/api/endpoints/products.ts`
- Modify: `fe/src/app/lib/api/endpoints/search.ts`
- Modify: `fe/src/app/pages/admin/SystemHealth.tsx`
- Modify: `fe/src/app/pages/checkout/CheckoutPage.tsx`
- Modify: `fe/src/app/types/api/cart.ts`
- Modify: `fe/src/app/types/api/checkout.ts`
- Modify: `fe/src/app/pages/checkout/types.ts`
- Modify: `fe/src/app/pages/checkout/CheckoutReviewStep.tsx`
- Modify: `fe/src/app/pages/checkout/CheckoutPaymentOptions.test.tsx`
- Modify: `fe/src/features/videos/hooks/useVideoUpload.ts`
- Test: `fe/src/app/hooks/use-cart.test.tsx`
- Test: `fe/src/app/hooks/use-products-v2.test.tsx`
- Test: `fe/src/app/hooks/use-search-v2.test.tsx`
- Test: `fe/src/app/hooks/use-wishlist.test.tsx`
- Test: `fe/src/features/videos/hooks/useVideoUpload.test.ts`

**Interfaces:**
- Consumes: existing Zod schemas and endpoint response shapes.
- Produces: `readJson(response, schema)`, inferred envelope types, schema-decoded browser storage, typed cart review fields, and payment-method parsing without casts.

- [ ] **Step 1: Write failing untrusted-JSON tests**

Create `fe/src/shared/api/read-json.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { readJson, readJsonText } from "./read-json";

describe("readJson", () => {
  it("returns schema-decoded data", async () => {
    const response = new Response(JSON.stringify({ status: "UP" }));
    await expect(readJson(response, z.object({ status: z.literal("UP") }))).resolves.toEqual({
      status: "UP",
    });
  });

  it("rejects malformed payloads", async () => {
    const response = new Response(JSON.stringify({ status: 12 }));
    await expect(readJson(response, z.object({ status: z.string() }))).rejects.toThrow();
  });

  it("parses text JSON as unknown before schema validation", () => {
    expect(readJsonText('{"ok":true}', z.object({ ok: z.boolean() }))).toEqual({ ok: true });
    expect(() => readJsonText('{"ok":"yes"}', z.object({ ok: z.boolean() }))).toThrow();
  });
});
```

- [ ] **Step 2: Run the test and confirm the helper is missing**

Run: `pnpm exec vitest run src/shared/api/read-json.test.ts`

Working directory: `fe`

Expected: FAIL because `read-json.ts` does not exist.

- [ ] **Step 3: Implement schema-first JSON readers**

Create `fe/src/shared/api/read-json.ts`:

```ts
import { z } from "zod";

export async function readJson<TSchema extends z.ZodType>(
  response: Response,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  const value: unknown = await response.json();
  return schema.parse(value);
}

export function readJsonText<TSchema extends z.ZodType>(
  text: string,
  schema: TSchema,
): z.infer<TSchema> {
  const value: unknown = JSON.parse(text);
  return schema.parse(value);
}
```

- [ ] **Step 4: Remove the envelope double assertion**

Change `fe/src/app/lib/api/envelope.ts` to infer the schema:

```ts
export const apiMetaSchema = z
  .object({
    requestId: z.string().optional(),
    cacheStatus: z.enum(["hit", "miss", "stale", "bypass"]).optional(),
    stale: z.boolean().optional(),
    nextCursor: z.string().nullable().optional(),
    hasMore: z.boolean().optional(),
  })
  .passthrough();

export const apiResponseSchema = <TSchema extends z.ZodType>(data: TSchema) =>
  z.object({
    success: z.boolean(),
    message: z.string(),
    data,
    errorCode: z.string().nullable(),
    timestamp: z.string(),
    meta: apiMetaSchema.optional(),
  });

export type ApiResponse<TSchema extends z.ZodType> = z.infer<
  ReturnType<typeof apiResponseSchema<TSchema>>
>;
```

Update consumers to pass schema types rather than response value types where the generic alias is referenced. Add an envelope test that parses a concrete `z.object({ id: z.string() })` and proves `data.id` is a string.

- [ ] **Step 5: Decode auth and health payloads**

Define the existing auth envelope as Zod schemas in `native-auth.ts`:

```ts
const authSessionSchema = z.object({
  accessToken: z.string().trim().min(1),
  accessExpiresIn: z.number().positive(),
});

const authEnvelopeSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    data: authSessionSchema.optional(),
    errorCode: z.string().optional(),
  })
  .passthrough()
  .nullable();

const jwtClaimsSchema = z
  .object({
    sub: z.string(),
    email: z.string().optional(),
    given_name: z.string().optional(),
    family_name: z.string().optional(),
    preferred_username: z.string().optional(),
    realm_access: z.object({ roles: z.array(z.string()).optional() }).optional(),
    exp: z.number().optional(),
  })
  .passthrough();
```

Replace the `JSON.parse(text) as ApiEnvelope<AuthSessionResponse>` assignment with:

```ts
const envelope = text ? readJsonText(text, authEnvelopeSchema) : null;
```

Infer `AuthSessionResponse` and `JwtClaims` from these schemas. In `decodeJwt`,
replace `JSON.parse(...) as JwtClaims` with
`readJsonText(decodedJson, jwtClaimsSchema)` inside the existing `try/catch`.

In `SystemHealth.tsx`, define:

```ts
const healthSchema = z.object({ status: z.string() }).passthrough();
```

and replace the cast with:

```ts
const body = await readJson(res, healthSchema);
```

In `use-app-config.ts`, keep `appConfigSchema.parse`, but first bind the raw value:

```ts
const raw: unknown = await response.json();
const config = appConfigSchema.parse(raw);
```

- [ ] **Step 6: Decode browser storage and stable serialized parameters**

Every `localStorage`, `sessionStorage`, and serialized query-parameter read is
untrusted. Use `readJsonText` with colocated Zod schemas:

- `use-cart.ts`: an array of objects with string `productId`, positive integer
  `quantity`, and optional string `variantId`;
- `use-wishlist.ts`: an array of strings;
- `use-recently-viewed.ts`: a strict array schema inferred as
  `RecentlyViewedItem[]`, plus malformed-entry tests;
- `useVideoUpload.ts`: a strict `ResumeEntry` schema with positive
  `sizeBytes`, plus a malformed-resume test;
- `CheckoutPage.tsx`: one checkout-draft schema for `step`,
  `selectedAddressIndex`, `shippingChoice`, `selectedPaymentId`, and `note`;
- `use-products-v2.ts` and `use-search-v2.ts`: exported input schemas beside
  the endpoint parameter types and schema parsing of the memoized serialized
  value.

Infer each local type from its schema. Remove hand-written assertions such as
`it as GuestCartItem`, `id as ProductId`, `v as PaymentOption["id"]`,
`JSON.parse(raw) as ResumeEntry`, and `JSON.parse(paramsKey) as ...`. Preserve
the existing malformed-storage fallback behavior and clear an invalid resume
entry rather than retrying it.

- [ ] **Step 7: Make cart review and payment options schema-derived**

In `cartItemSchema`, keep fields the cart service actually emits:

```ts
sellerName: z.string().optional(),
variantId: z.string().nullable().optional(),
variantSku: z.string().nullable().optional(),
```

Expose in the transform:

```ts
sellerName: raw.sellerName,
variantId: raw.variantId ?? raw.variantSku ?? undefined,
```

In `CheckoutReviewStep.tsx`, remove `item as any`, use `item.variantId` and `item.sellerName`, and remove the stock warning because cart-service does not return stock in its cart response contract.

Reuse `checkoutProviderSchema` from the replacement checkout plan while keeping
the wire field forward-compatible:

```ts
export const paymentMethodSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    enabled: z.boolean().default(true),
  })
  .passthrough();

export type PaymentMethodOption = z.infer<typeof paymentMethodSchema>;
```

Delete `RawPaymentMethod`. Import `PaymentMethodOption`, uppercase the server's
lowercase `id`, and validate it before mapping:

```ts
const parsedCode = checkoutProviderSchema.safeParse(method.id.toUpperCase());
if (!parsedCode.success) {
  console.warn(`[CheckoutPage] Unsupported payment id "${method.id}"`);
  return [];
}
return [{ ...knownOptions[parsedCode.data], name: method.name }];
```

Map known methods with a complete `Record<CheckoutProvider, PaymentOption>`, use
`flatMap` for the validated result above, and remove the arbitrary
`p.code as PaymentOption["id"]` fallback. Preserve enabled Stripe, PayPal, and
VietQR after Plan 02a's payment-service prerequisite; reject `sepay`, legacy
`BANK`, unknown methods, and any payment-method fallback.

- [ ] **Step 8: Verify malformed boundary behavior and existing contracts**

Run from `fe`:

```powershell
pnpm exec vitest run src/shared/api/read-json.test.ts src/app/lib/api/envelope.test.ts src/app/lib/api/endpoints/auth.test.ts src/app/lib/auth/native-auth.test.ts src/app/hooks/use-app-config.test.ts src/app/hooks/use-cart.test.tsx src/app/hooks/use-products-v2.test.tsx src/app/hooks/use-recently-viewed.test.ts src/app/hooks/use-search-v2.test.tsx src/app/hooks/use-wishlist.test.tsx src/app/types/api src/app/pages/checkout/CheckoutPaymentOptions.test.tsx src/app/pages/checkout/CheckoutReviewStep.test.tsx src/features/videos/hooks/useVideoUpload.test.ts
pnpm run typecheck
pnpm run lint:changed -- --base $env:LINT_BASE_SHA
```

Expected: PASS. Malformed auth, health, envelope, cart, and payment-method data fail at schemas rather than reaching presentation.

- [ ] **Step 9: Review and commit**

Use the master Review Gate, then commit:

```powershell
# Set $taskFiles to the task's exact Files inventory.
Add-ReviewedTaskFiles -Paths $taskFiles
git commit -m "refactor(fe): validate untrusted frontend data"
```

### Task 4: Enforce Unsafe-Boundary Regression Gates

**Files:**
- Create: `fe/scripts/check-type-safety.mjs`
- Create: `fe/scripts/check-type-safety.test.mjs`
- Modify: `fe/package.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `fe/src/app/lib/api/client.ts`
- Modify: `fe/src/app/components/notifications/notification-preferences-page.tsx`
- Modify: `fe/src/app/components/notification-toast.tsx`
- Modify: `fe/src/app/components/seller-product-modal.tsx`
- Modify: `fe/src/app/components/vnshop-context.tsx`
- Modify: `fe/src/app/hooks/use-auth.tsx`
- Modify: `fe/src/app/hooks/use-admin-video-moderation.ts`
- Modify: `fe/src/app/hooks/use-messages.ts`
- Modify: `fe/src/app/hooks/use-messaging-socket.ts`
- Modify: `fe/src/app/hooks/use-orders.ts`
- Modify: `fe/src/app/hooks/use-sellers.ts`
- Modify: `fe/src/app/lib/api/telemetry-store.ts`
- Modify: `fe/src/app/pages/admin/CouponDialog.tsx`
- Modify: `fe/src/app/pages/admin/CouponsManagement.tsx`
- Modify: `fe/src/app/pages/admin/PayoutsQueue.tsx`
- Modify: `fe/src/app/pages/admin/ReviewsModeration.tsx`
- Modify: `fe/src/app/pages/admin/VideoAppeals.tsx`
- Modify: `fe/src/app/pages/admin/VideoModeration.tsx`
- Modify: `fe/src/app/pages/checkout/CheckoutReviewStep.tsx`
- Modify: `fe/src/app/pages/OrdersPage.tsx`
- Modify: `fe/src/app/pages/ProductPage.tsx`
- Modify: `fe/src/app/pages/SearchPage.tsx`
- Modify: `fe/src/app/pages/seller/SellerPage.tsx`
- Modify: `fe/src/app/pages/seller/SellerProducts.tsx`
- Modify: `fe/src/app/pages/seller/ShipDialog.tsx`
- Modify: `fe/src/app/routes.ts`
- Modify: `fe/src/features/videos/components/VideoPlayer.tsx`
- Modify: `fe/src/features/videos/hooks/useVideoStatus.ts`
- Modify: `fe/src/main.tsx`

**Interfaces:**
- Consumes: aggregate typecheck and typed lint projects from Plan 01.
- Produces: `pnpm run lint:type-safety`, a CI-blocking changed-code scan, and zero known unsafe production suppressions.

- [ ] **Step 1: Write a failing source-scan test**

Create `fe/scripts/check-type-safety.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";

import { findUnsafeLines } from "./check-type-safety.mjs";

test("findUnsafeLines rejects type escapes and permits ordinary assertions", () => {
  assert.deepEqual(
    findUnsafeLines(
      `const x = value as any;
// @ts-ignore
const parseJson = JSON.parse;
const y = parseJson(
  raw,
) as Value;
const z = (
  await response.json()
) as Value;
const readResponse = response.json.bind(response);
const w = (await readResponse()) as Value;
`,
    ),
    [
      { line: 1, pattern: "as any" },
      { line: 2, pattern: "@ts-ignore" },
      { line: 4, pattern: "JSON.parse assertion" },
      { line: 7, pattern: "response.json assertion" },
      { line: 11, pattern: "response.json assertion" },
    ],
  );
  assert.deepEqual(findUnsafeLines("const x = value as HTMLInputElement;\n"), []);
});

test("tracks assertion-only trust through parsed-value aliases", () => {
  const findings = findUnsafeLines(`
    const parsed = JSON.parse(raw);
    const aliased = parsed;
    const domain = aliased as Domain;
    const responsePayload = await response.json();
    const responseDomain = responsePayload as Domain;
  `);
  assert.deepEqual(
    findings.map(({ pattern }) => pattern),
    ["JSON.parse assertion", "response.json assertion"],
  );
});

test("rejects non-null assertions in production code", () => {
  assert.deepEqual(findUnsafeLines("const seller = sellerId!;\n"), [
    { line: 1, pattern: "non-null assertion" },
  ]);
});

test("rejects nocheck, every lint suppression, and computed or destructured boundaries", () => {
  const findings = findUnsafeLines(`
    // @ts-nocheck
    // eslint-disable
    /* eslint
       @typescript-eslint/no-unsafe-assignment: "off"
    */
    /* eslint @typescript-eslint/no-unsafe-return: ["off", { allow: [] }] */
    const parse = JSON[\`parse\`];
    const computed = parse(raw) as Domain;
    const { parse: destructured } = JSON;
    const value = destructured(raw) as Domain;
    const read = response["json"]["bind"](response);
    const payload = (await read()) as Domain;
    const { json: destructuredRead } = response;
    const destructuredPayload = (await destructuredRead.call(response)) as Domain;
  `);
  assert.deepEqual(
    findings.map(({ pattern }) => pattern),
    [
      "@ts-nocheck",
      "lint suppression",
      "lint suppression",
      "lint suppression",
      "JSON.parse assertion",
      "JSON.parse assertion",
      "response.json assertion",
      "response.json assertion",
    ],
  );
});

test("finds a JSX trailing lint suppression comment", () => {
  assert.deepEqual(
    findUnsafeLines(
      `const view = <section>ready</section>;
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const payload = source;
`,
      "fixture.tsx",
    ),
    [{ line: 2, pattern: "lint suppression" }],
  );
});
```

- [ ] **Step 2: Run the test and confirm the scanner is missing**

Run: `node --test fe/scripts/check-type-safety.test.mjs`

Expected: FAIL because `check-type-safety.mjs` does not exist.

- [ ] **Step 3: Implement the production source scanner**

Create `fe/scripts/check-type-safety.mjs`:

```js
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseForESLint } from "@typescript-eslint/parser";
import ts from "typescript";

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const commentPatterns = [
  ["@ts-ignore", /@ts-ignore/],
  ["@ts-expect-error", /@ts-expect-error/],
  ["@ts-nocheck", /@ts-nocheck/],
  [
    "lint suppression",
    /\beslint(?:-disable(?:-next-line|-line)?\b|[\s\S]*?:\s*(?:\[\s*)?(?:"off"|'off'|0)(?=\s|[,}\]]))/,
  ],
];

const unwrap = (node) => {
  let current = node;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAwaitExpression(current)
  ) {
    current = current.expression;
  }
  return current;
};
const literalMemberName = (node) =>
  ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
    ? node.text
    : null;

export function findUnsafeLines(source, fileName = "source.tsx") {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const jsonParseAliases = new Set();
  const responseJsonAliases = new Set();
  const jsonValueAliases = new Set();
  const responseValueAliases = new Set();
  const findings = [];
  const parsed = parseForESLint(source, {
    comment: true,
    filePath: fileName,
    jsx: fileName.endsWith(".tsx"),
    loc: true,
    range: true,
  });
  for (const comment of parsed.ast.comments ?? []) {
    const commentText = comment.value;
    const line = comment.loc.start.line;
    for (const [pattern, expression] of commentPatterns) {
      if (expression.test(commentText)) findings.push({ line, pattern });
    }
  }
  const lineOf = (node) =>
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
  const add = (node, pattern) => findings.push({ line: lineOf(node), pattern });
  const isJsonParse = (expression) => {
    const target = unwrap(expression);
    return (
      (ts.isPropertyAccessExpression(target) &&
        ts.isIdentifier(target.expression) &&
        target.expression.text === "JSON" &&
        target.name.text === "parse") ||
      (ts.isElementAccessExpression(target) &&
        ts.isIdentifier(target.expression) &&
        target.expression.text === "JSON" &&
        literalMemberName(target.argumentExpression) === "parse") ||
      (ts.isIdentifier(target) && jsonParseAliases.has(target.text))
    );
  };
  const isResponseJson = (expression) => {
    const target = unwrap(expression);
    if (ts.isIdentifier(target)) return responseJsonAliases.has(target.text);
    if (ts.isPropertyAccessExpression(target)) {
      if (target.name.text === "bind" || target.name.text === "call") {
        return isResponseJson(target.expression);
      }
      return target.name.text === "json";
    }
    if (
      ts.isElementAccessExpression(target) &&
      literalMemberName(target.argumentExpression)
    ) {
      const member = literalMemberName(target.argumentExpression);
      if (member === "bind" || member === "call") {
        return isResponseJson(target.expression);
      }
      return member === "json";
    }
    return (
      ts.isCallExpression(target) &&
      (ts.isPropertyAccessExpression(target.expression) ||
        ts.isElementAccessExpression(target.expression)) &&
      ((ts.isPropertyAccessExpression(target.expression) &&
        target.expression.name.text === "bind") ||
        (ts.isElementAccessExpression(target.expression) &&
          literalMemberName(target.expression.argumentExpression) === "bind")) &&
      isResponseJson(target.expression.expression)
    );
  };
  const collectAliases = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      node.initializer
    ) {
      const initializer = unwrap(node.initializer);
      for (const element of node.name.elements) {
        if (!ts.isIdentifier(element.name)) continue;
        const propertyName =
          element.propertyName && ts.isIdentifier(element.propertyName)
            ? element.propertyName.text
            : element.name.text;
        if (
          ts.isIdentifier(initializer) &&
          initializer.text === "JSON" &&
          propertyName === "parse"
        ) {
          jsonParseAliases.add(element.name.text);
        }
        if (propertyName === "json") {
          responseJsonAliases.add(element.name.text);
        }
      }
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      isJsonParse(node.initializer)
    ) {
      jsonParseAliases.add(node.name.text);
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      isResponseJson(node.initializer)
    ) {
      responseJsonAliases.add(node.name.text);
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const initializer = unwrap(node.initializer);
      if (ts.isCallExpression(initializer)) {
        if (isJsonParse(initializer.expression)) jsonValueAliases.add(node.name.text);
        if (isResponseJson(initializer.expression)) responseValueAliases.add(node.name.text);
      } else if (ts.isIdentifier(initializer)) {
        if (jsonValueAliases.has(initializer.text)) jsonValueAliases.add(node.name.text);
        if (responseValueAliases.has(initializer.text)) responseValueAliases.add(node.name.text);
      }
    }
    ts.forEachChild(node, collectAliases);
  };
  collectAliases(sourceFile);
  const visit = (node) => {
    if (ts.isNonNullExpression(node)) add(node, "non-null assertion");
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      if (node.type.kind === ts.SyntaxKind.AnyKeyword) add(node, "as any");
      const assertedExpression = unwrap(node.expression);
      if (
        (ts.isAsExpression(assertedExpression) ||
          ts.isTypeAssertionExpression(assertedExpression)) &&
        assertedExpression.type.kind === ts.SyntaxKind.UnknownKeyword
      ) {
        add(node, "double assertion");
      }
      const boundary = assertedExpression;
      if (ts.isIdentifier(boundary) && jsonValueAliases.has(boundary.text)) {
        add(node, "JSON.parse assertion");
      }
      if (ts.isIdentifier(boundary) && responseValueAliases.has(boundary.text)) {
        add(node, "response.json assertion");
      }
      if (ts.isCallExpression(boundary)) {
        const callee = unwrap(boundary.expression);
        if (isJsonParse(callee)) add(node, "JSON.parse assertion");
        if (isResponseJson(callee)) {
          add(node, "response.json assertion");
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return findings.sort((a, b) => a.line - b.line || a.pattern.localeCompare(b.pattern));
}

function filesUnder(directory) {
  return readdirSync(directory).flatMap((name) => {
    const target = path.join(directory, name);
    if (statSync(target).isDirectory()) return filesUnder(target);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [target] : [];
  });
}

const findings = filesUnder(sourceRoot).flatMap((file) =>
  findUnsafeLines(readFileSync(file, "utf8"), file).map((finding) => ({
    file: path.relative(sourceRoot, file).replaceAll("\\", "/"),
    ...finding,
  })),
);

if (findings.length > 0) {
  for (const finding of findings) {
    console.error(`${finding.file}:${finding.line} ${finding.pattern}`);
  }
  process.exitCode = 1;
}
```

Add:

```json
{
  "scripts": {
    "lint:type-safety": "node scripts/check-type-safety.mjs",
    "lint:all": "pnpm run lint && pnpm run lint:i18n && pnpm run lint:tokens && pnpm run lint:type-safety"
  }
}
```

- [ ] **Step 4: Remove current known production escapes**

In `fe/src/app/lib/api/client.ts`, replace:

```ts
let _refreshLockTimestamp: any = 0;
```

with:

```ts
let refreshLockTimestamp = 0;
```

Update all references to the new name. The task owns every currently known
production suppression file listed above. Fix every scanner finding with a
schema, type guard, typed fixture, or local type that represents the runtime
value. Do not add scanner allowlists, leave cleanup for a later plan, or commit
the gate while any owned production file still fails it.

- [ ] **Step 5: Add the type-safety gate to frontend CI**

The frontend job already calls `pnpm run verify`. Update `verify` in `fe/package.json` to invoke `pnpm run lint:all`, so `.github/workflows/ci.yml` needs only its token path correction:

```yaml
frontend:
  - 'fe/**'
  - 'design-system/**'
  - 'scripts/generate-design-tokens.mjs'
  - 'scripts/generate-design-tokens.test.mjs'
```

Make the same `design-system/**` correction in the mobile filter. Do not change the `npm` ecosystem name in Dependabot; it covers JavaScript package managers including pnpm.

- [ ] **Step 6: Verify all boundary gates**

Run from `fe`:

```powershell
node --test scripts/check-type-safety.test.mjs
pnpm run lint:type-safety
pnpm run typecheck
pnpm run lint:all
pnpm run test
pnpm run build
```

Expected: all commands pass with no unsafe production-source findings.

- [ ] **Step 7: Review and commit**

Use the master Review Gate, then commit:

```powershell
# Set $taskFiles to the task's exact Files inventory.
Add-ReviewedTaskFiles -Paths $taskFiles
git commit -m "test(fe): enforce frontend type boundaries"
```
