import type { CheckoutProvider } from "@/shared/contracts/api";

export type AttemptIdentity = {
  orderKey: string;
  cartFingerprint: string;
  provider: CheckoutProvider;
};

export type CreatedOrder = AttemptIdentity & {
  paymentKey: string;
  orderId: string;
  total: number;
};

export type ProviderState =
  | { kind: "cod" }
  | { kind: "redirect"; redirectUrl: string }
  | { kind: "vietqr"; qrImageUrl: string; reference: string }
  | { kind: "stripe"; publishableKey: string; clientSecret: string; intentId: string }
  | { kind: "paypal"; clientId: string; paypalOrderId: string };

export type InitializedPayment = CreatedOrder & {
  paymentId: string;
  providerState: ProviderState;
};

export type CheckoutSubmissionState =
  | { status: "draft"; orderKey: string; cartFingerprint: string }
  | ({ status: "placing" } & AttemptIdentity)
  | ({ status: "order-created" } & CreatedOrder)
  | ({ status: "payment-initializing" } & CreatedOrder)
  | ({ status: "pending" } & InitializedPayment)
  | ({ status: "completed" } & InitializedPayment)
  | ({ status: "reconciling"; startedAt: number } & AttemptIdentity)
  | ({ status: "uncertain"; message: string } & AttemptIdentity)
  | ({ status: "failed"; stage: "payment"; message: string; paymentId?: string } & CreatedOrder);

export type CheckoutSubmissionEvent =
  | { type: "place"; attempt: AttemptIdentity }
  | { type: "order-created"; order: CreatedOrder }
  | { type: "payment-initializing" }
  | { type: "payment-pending"; payment: InitializedPayment }
  | { type: "payment-completed"; payment: InitializedPayment }
  | { type: "payment-failed"; message: string; paymentId?: string }
  | { type: "reconciling"; startedAt: number }
  | { type: "uncertain"; message: string }
  | { type: "new-draft"; orderKey: string; cartFingerprint: string };

export function checkoutSubmissionReducer(
  state: CheckoutSubmissionState,
  event: CheckoutSubmissionEvent,
): CheckoutSubmissionState {
  switch (event.type) {
    case "place":
      return state.status === "draft" ? { status: "placing", ...event.attempt } : state;
    case "order-created":
      return state.status === "placing" || state.status === "reconciling"
        ? { status: "order-created", ...event.order }
        : state;
    case "payment-initializing":
      return state.status === "order-created" || state.status === "failed"
        ? { status: "payment-initializing", ...createdOrder(state) }
        : state;
    case "payment-pending":
      return state.status === "payment-initializing"
        ? { status: "pending", ...event.payment }
        : state;
    case "payment-completed":
      return state.status === "payment-initializing" || state.status === "pending"
        ? { status: "completed", ...event.payment }
        : state;
    case "payment-failed":
      return ownsOrder(state)
        ? {
            status: "failed",
            stage: "payment",
            ...createdOrder(state),
            message: event.message,
            paymentId: event.paymentId,
          }
        : state;
    case "reconciling":
      return state.status === "placing"
        ? { status: "reconciling", ...attemptIdentity(state), startedAt: event.startedAt }
        : state;
    case "uncertain":
      return state.status === "reconciling"
        ? { status: "uncertain", ...attemptIdentity(state), message: event.message }
        : state;
    case "new-draft":
      return state.status === "completed" || state.status === "failed"
        ? { status: "draft", orderKey: event.orderKey, cartFingerprint: event.cartFingerprint }
        : state;
  }
}

export function ownsOrder(
  state: CheckoutSubmissionState,
): state is Exclude<
  CheckoutSubmissionState,
  { status: "draft" | "placing" | "reconciling" | "uncertain" }
> {
  return ["order-created", "payment-initializing", "pending", "completed", "failed"].includes(
    state.status,
  );
}

export function createdOrder(
  state: Extract<CheckoutSubmissionState, { orderId: string }>,
): CreatedOrder {
  return {
    orderKey: state.orderKey,
    cartFingerprint: state.cartFingerprint,
    provider: state.provider,
    paymentKey: state.paymentKey,
    orderId: state.orderId,
    total: state.total,
  };
}

export function attemptIdentity(
  state: Extract<CheckoutSubmissionState, AttemptIdentity>,
): AttemptIdentity {
  return {
    orderKey: state.orderKey,
    cartFingerprint: state.cartFingerprint,
    provider: state.provider,
  };
}
