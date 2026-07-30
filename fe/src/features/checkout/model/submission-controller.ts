import type { PlaceOrderInput } from "@/shared/api/endpoints/orders";
import type { CheckoutProvider, PaymentStatus } from "@/shared/contracts/api";

import type { CheckoutRecoveryRecord, CheckoutRecoveryStore } from "./recovery";
import {
  attemptIdentity,
  checkoutSubmissionReducer,
  createdOrder,
  ownsOrder,
  type CheckoutSubmissionState,
  type CreatedOrder,
  type InitializedPayment,
  type ProviderState,
} from "./submission";

type OrderResult = { id: string; total: number };
type OrderLookup = { kind: "found"; order: OrderResult } | { kind: "not-found" };
type RedirectPayment = PaymentStatus;
type VietQrPayment = {
  payment: PaymentStatus;
  qrImageUrl: string;
  reference: string;
};
type StripePayment = {
  payment: PaymentStatus;
  publishableKey: string;
  clientSecret: string;
  intentId: string;
};
type PayPalPayment = {
  payment: PaymentStatus;
  clientId: string;
  paypalOrderId: string;
};

export interface CheckoutSubmissionDependencies {
  placeOrder(order: PlaceOrderInput, idempotencyKey: string): Promise<OrderResult>;
  findOrderByIdempotencyKey(idempotencyKey: string): Promise<OrderLookup>;
  codConfirm(body: { orderId: string }, idempotencyKey: string): Promise<PaymentStatus>;
  vnpayCreate(body: { orderId: string }, idempotencyKey: string): Promise<RedirectPayment>;
  momoCreate(body: { orderId: string }, idempotencyKey: string): Promise<RedirectPayment>;
  vietqrCreate(body: { orderId: string }, idempotencyKey: string): Promise<VietQrPayment>;
  stripeCreate(body: { orderId: string }, idempotencyKey: string): Promise<StripePayment>;
  paypalCreate(body: { orderId: string }, idempotencyKey: string): Promise<PayPalPayment>;
  recovery: CheckoutRecoveryStore;
  newKey(): string;
  now(): number;
  sleep(milliseconds: number): Promise<void>;
  reconciliationAttempts?: number;
  reconciliationDelayMs?: number;
}

export interface CheckoutSubmissionInput {
  order: PlaceOrderInput;
  provider: CheckoutProvider;
}

export interface CheckoutSubmissionResult {
  state: CheckoutSubmissionState;
  orderId?: string;
  redirectUrl?: string;
}

export interface CheckoutSubmissionController {
  getState(): CheckoutSubmissionState;
  subscribe(listener: (state: CheckoutSubmissionState) => void): () => void;
  updateCartFingerprint(fingerprint: string): void;
  submit(input: CheckoutSubmissionInput): Promise<CheckoutSubmissionResult>;
  resume(): Promise<CheckoutSubmissionResult>;
}

export function createCheckoutSubmissionController(
  dependencies: CheckoutSubmissionDependencies,
  initialCartFingerprint = "",
): CheckoutSubmissionController {
  const listeners = new Set<(state: CheckoutSubmissionState) => void>();
  let state: CheckoutSubmissionState = {
    status: "draft",
    orderKey: dependencies.newKey(),
    cartFingerprint: initialCartFingerprint,
  };
  let inFlight: Promise<CheckoutSubmissionResult> | null = null;

  const transition = (event: Parameters<typeof checkoutSubmissionReducer>[1]) => {
    state = checkoutSubmissionReducer(state, event);
    for (const listener of listeners) listener(state);
  };

  const replaceState = (next: CheckoutSubmissionState) => {
    state = next;
    for (const listener of listeners) listener(state);
  };

  const providerAdapters: Record<
    CheckoutProvider,
    (order: CreatedOrder) => Promise<InitializedPayment>
  > = {
    COD: async (order) => {
      const payment = await dependencies.codConfirm({ orderId: order.orderId }, order.paymentKey);
      if (payment.status !== "AWAITING_COLLECTION" && payment.status !== "COMPLETED") {
        throw new Error(`COD payment is not ready: ${payment.status}`);
      }
      return initialized(order, payment.paymentId, { kind: "cod" });
    },
    VNPAY: async (order) =>
      redirect(order, await dependencies.vnpayCreate({ orderId: order.orderId }, order.paymentKey)),
    MOMO: async (order) =>
      redirect(order, await dependencies.momoCreate({ orderId: order.orderId }, order.paymentKey)),
    VIETQR: async (order) => {
      const result = await dependencies.vietqrCreate({ orderId: order.orderId }, order.paymentKey);
      require(result.payment.paymentId, "VietQR payment ID");
      require(result.qrImageUrl, "VietQR QR URL");
      require(result.reference, "VietQR reference");
      return initialized(order, result.payment.paymentId, {
        kind: "vietqr",
        qrImageUrl: result.qrImageUrl,
        reference: result.reference,
      });
    },
    STRIPE: async (order) => {
      const result = await dependencies.stripeCreate({ orderId: order.orderId }, order.paymentKey);
      require(result.payment.paymentId, "Stripe payment ID");
      require(result.publishableKey, "Stripe publishable key");
      require(result.clientSecret, "Stripe client secret");
      require(result.intentId, "Stripe intent ID");
      return initialized(order, result.payment.paymentId, {
        kind: "stripe",
        publishableKey: result.publishableKey,
        clientSecret: result.clientSecret,
        intentId: result.intentId,
      });
    },
    PAYPAL: async (order) => {
      const result = await dependencies.paypalCreate({ orderId: order.orderId }, order.paymentKey);
      require(result.payment.paymentId, "PayPal payment ID");
      require(result.clientId, "PayPal client ID");
      require(result.paypalOrderId, "PayPal order ID");
      return initialized(order, result.payment.paymentId, {
        kind: "paypal",
        clientId: result.clientId,
        paypalOrderId: result.paypalOrderId,
      });
    },
  };

  const initializePayment = async (order: CreatedOrder): Promise<CheckoutSubmissionResult> => {
    transition({ type: "payment-initializing" });
    try {
      const payment = await providerAdapters[order.provider](order);
      persistPaymentRecovery(payment);
      if (payment.providerState.kind === "cod") {
        transition({ type: "payment-completed", payment });
      } else {
        transition({ type: "payment-pending", payment });
      }
      return resultFor(payment, state);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Payment initialization failed";
      transition({ type: "payment-failed", message });
      dependencies.recovery.write(createdRecovery(order));
      return { state, orderId: order.orderId };
    }
  };

  const reconcile = async (attempt: {
    order: PlaceOrderInput;
    provider: CheckoutProvider;
    orderKey: string;
    cartFingerprint: string;
  }) => {
    transition({ type: "reconciling", startedAt: dependencies.now() });
    const maxAttempts = dependencies.reconciliationAttempts ?? 3;
    const delay = dependencies.reconciliationDelayMs ?? 150;
    for (let index = 0; index < maxAttempts; index += 1) {
      dependencies.recovery.write({
        version: 1,
        phase: "order",
        orderKey: attempt.orderKey,
        cartFingerprint: attempt.cartFingerprint,
        provider: attempt.provider,
        order: attempt.order,
        reconciliationAttempts: index + 1,
        reconciliationDeadline: dependencies.now() + delay * (maxAttempts - index),
      });
      const found = await dependencies.findOrderByIdempotencyKey(attempt.orderKey);
      if (found.kind === "found") {
        const order: CreatedOrder = {
          ...attempt,
          paymentKey: dependencies.newKey(),
          orderId: found.order.id,
          total: found.order.total,
        };
        transition({ type: "order-created", order });
        dependencies.recovery.write(createdRecovery(order));
        return initializePayment(order);
      }
      if (index + 1 < maxAttempts) await dependencies.sleep(delay * 2 ** index);
    }
    transition({ type: "uncertain", message: "Order placement could not be confirmed" });
    return { state };
  };

  const start = async (input: CheckoutSubmissionInput): Promise<CheckoutSubmissionResult> => {
    if (state.status === "pending") return stateResult(state);
    if (state.status === "completed") {
      transition({
        type: "new-draft",
        orderKey: dependencies.newKey(),
        cartFingerprint: state.cartFingerprint,
      });
    }
    if (ownsOrder(state)) return initializePayment(createdOrder(state));
    if (state.status === "uncertain") return { state };

    const attempt = {
      order: structuredClone(input.order),
      provider: input.provider,
      orderKey: state.orderKey,
      cartFingerprint: state.cartFingerprint,
    };
    transition({ type: "place", attempt: attemptIdentity({ status: "placing", ...attempt }) });
    dependencies.recovery.write({
      version: 1,
      phase: "order",
      orderKey: attempt.orderKey,
      cartFingerprint: attempt.cartFingerprint,
      provider: attempt.provider,
      order: attempt.order,
      reconciliationAttempts: 0,
      reconciliationDeadline: dependencies.now(),
    });
    try {
      const placed = await dependencies.placeOrder(attempt.order, attempt.orderKey);
      const order: CreatedOrder = {
        ...attempt,
        paymentKey: dependencies.newKey(),
        orderId: placed.id,
        total: placed.total,
      };
      transition({ type: "order-created", order });
      dependencies.recovery.write(createdRecovery(order));
      return initializePayment(order);
    } catch {
      return reconcile(attempt);
    }
  };

  const resumeRecovery = async (): Promise<CheckoutSubmissionResult> => {
    const recovery = dependencies.recovery.read();
    if (!recovery) return { state };

    switch (recovery.phase) {
      case "order": {
        replaceState({
          status: "placing",
          orderKey: recovery.orderKey,
          cartFingerprint: recovery.cartFingerprint,
          provider: recovery.provider,
        });
        return reconcile(recovery);
      }
      case "created":
      case "stripe": {
        const order: CreatedOrder = {
          orderKey: recovery.orderKey,
          cartFingerprint: recovery.cartFingerprint,
          provider: recovery.provider,
          paymentKey: recovery.paymentKey,
          orderId: recovery.orderId,
          total: recovery.total,
        };
        replaceState({ status: "order-created", ...order });
        return initializePayment(order);
      }
      case "vietqr": {
        const payment = initialized(recoveryOrder(recovery), recovery.paymentId, {
          kind: "vietqr",
          qrImageUrl: recovery.qrImageUrl,
          reference: recovery.reference,
        });
        replaceState({ status: "pending", ...payment });
        return stateResult(state);
      }
      case "paypal": {
        const payment = initialized(recoveryOrder(recovery), recovery.paymentId, {
          kind: "paypal",
          clientId: recovery.clientId,
          paypalOrderId: recovery.paypalOrderId,
        });
        replaceState({ status: "pending", ...payment });
        return stateResult(state);
      }
      case "redirect":
        return { state, orderId: recovery.orderId };
    }
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    updateCartFingerprint(fingerprint) {
      if (state.status === "draft") {
        state = { ...state, cartFingerprint: fingerprint };
        for (const listener of listeners) listener(state);
      }
    },
    submit(input) {
      if (inFlight) return inFlight;
      const promise = start(input).finally(() => {
        inFlight = null;
      });
      inFlight = promise;
      return promise;
    },
    resume() {
      if (inFlight) return inFlight;
      const promise = resumeRecovery().finally(() => {
        inFlight = null;
      });
      inFlight = promise;
      return promise;
    },
  };

  function createdRecovery(order: CreatedOrder) {
    return {
      version: 1 as const,
      phase: "created" as const,
      orderKey: order.orderKey,
      cartFingerprint: order.cartFingerprint,
      provider: order.provider,
      paymentKey: order.paymentKey,
      orderId: order.orderId,
      total: order.total,
    };
  }

  function persistPaymentRecovery(payment: InitializedPayment) {
    const base = {
      version: 1 as const,
      orderKey: payment.orderKey,
      cartFingerprint: payment.cartFingerprint,
      provider: payment.provider,
      paymentKey: payment.paymentKey,
      orderId: payment.orderId,
      paymentId: payment.paymentId,
      total: payment.total,
    };
    switch (payment.providerState.kind) {
      case "cod":
        dependencies.recovery.clear();
        return;
      case "redirect":
        if (payment.provider === "VNPAY" || payment.provider === "MOMO") {
          dependencies.recovery.write({ ...base, phase: "redirect", provider: payment.provider });
        }
        return;
      case "vietqr":
        dependencies.recovery.write({ ...base, phase: "vietqr", ...payment.providerState });
        return;
      case "stripe":
        dependencies.recovery.write({
          ...base,
          phase: "stripe",
          intentId: payment.providerState.intentId,
          publishableKey: payment.providerState.publishableKey,
        });
        return;
      case "paypal":
        dependencies.recovery.write({ ...base, phase: "paypal", ...payment.providerState });
        return;
    }
  }
}

function initialized(
  order: CreatedOrder,
  paymentId: string,
  providerState: ProviderState,
): InitializedPayment {
  return { ...order, paymentId, providerState };
}

function redirect(order: CreatedOrder, payment: RedirectPayment): InitializedPayment {
  require(payment.paymentId, "Redirect payment ID");
  require(payment.redirectUrl, "Redirect URL");
  return initialized(order, payment.paymentId, {
    kind: "redirect",
    redirectUrl: payment.redirectUrl,
  });
}

function resultFor(
  payment: InitializedPayment,
  state: CheckoutSubmissionState,
): CheckoutSubmissionResult {
  return {
    state,
    orderId: payment.orderId,
    redirectUrl:
      payment.providerState.kind === "redirect" ? payment.providerState.redirectUrl : undefined,
  };
}

function recoveryOrder(
  recovery: Extract<CheckoutRecoveryRecord, { paymentKey: string }>,
): CreatedOrder {
  return {
    orderKey: recovery.orderKey,
    cartFingerprint: recovery.cartFingerprint,
    provider: recovery.provider,
    paymentKey: recovery.paymentKey,
    orderId: recovery.orderId,
    total: recovery.total,
  };
}

function stateResult(state: CheckoutSubmissionState): CheckoutSubmissionResult {
  if (!ownsOrder(state)) return { state };
  return {
    state,
    orderId: state.orderId,
    redirectUrl:
      state.status === "pending" && state.providerState.kind === "redirect"
        ? state.providerState.redirectUrl
        : undefined,
  };
}

function require(value: string | null | undefined, label: string): asserts value is string {
  if (!value) throw new Error(`${label} is required`);
}
