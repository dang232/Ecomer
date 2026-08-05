import { useMutation, useQuery } from "@tanstack/react-query";
import { LogIn, Package } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { z } from "zod";

import { ApiError } from "@/shared/api";
import {
  calculateCheckout,
  paymentMethods as fetchPaymentMethods,
} from "@/shared/api/endpoints/checkout";
import { listActiveCoupons, validateCouponCode } from "@/shared/api/endpoints/coupons";
import { findOrderByIdempotencyKey, placeOrder } from "@/shared/api/endpoints/orders";
import {
  codConfirm,
  momoCreate,
  paypalCreate,
  stripeCreate,
  vietqrCreate,
  vnpayCreate,
} from "@/shared/api/endpoints/payment";
import { myProfile } from "@/shared/api/endpoints/users";
import { checkoutProviderSchema, type Address } from "@/shared/contracts/api";

import {
  CheckoutPageView,
  cleanupThenRedirect,
  createCheckoutRecoveryStore,
  createCheckoutSubmissionController,
  shouldClearCartAfterSubmission,
  type CheckoutRecoveryStore,
  type CheckoutSubmissionController,
  type CheckoutSubmissionResult,
} from "../../../features/checkout";
import { readJsonText } from "../../../shared/api/read-json";
import { useAuth } from "../../hooks/auth-context";
import { useCart } from "../../hooks/use-cart";

import { CheckoutAddressStep } from "./CheckoutAddressStep";
import { CheckoutPaymentRecovery } from "./CheckoutPaymentRecovery";
import { CheckoutPaymentStep } from "./CheckoutPaymentStep";
import { CheckoutReviewStep } from "./CheckoutReviewStep";
import { CheckoutShippingStep } from "./CheckoutShippingStep";
import { CheckoutStepper } from "./CheckoutStepper";
import { CheckoutSuccess } from "./CheckoutSuccess";
import { CheckoutSummary } from "./CheckoutSummary";
import { toPaymentOptions, type PaymentOption, type Step } from "./types";

const checkoutProgressSchema = z.object({
  step: z.enum(["address", "shipping", "payment", "review", "success"]).optional(),
  selectedAddressIndex: z.number().int().nonnegative().optional(),
  shippingChoice: z.string().optional(),
  selectedPaymentId: checkoutProviderSchema.optional(),
  note: z.string().optional(),
});
type CheckoutProgress = z.infer<typeof checkoutProgressSchema>;

function readCheckoutProgress(): CheckoutProgress | null {
  try {
    const raw = sessionStorage.getItem("vnshop:checkout-state");
    return raw ? readJsonText(raw, checkoutProgressSchema) : null;
  } catch {
    try {
      sessionStorage.removeItem("vnshop:checkout-state");
    } catch {
      /* browser storage is unavailable */
    }
    return null;
  }
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const { ready, authenticated, login, profile } = useAuth();
  const { items: cartItems, totalAmount, isLoading: cartLoading, removePurchasedItems } = useCart();
  const { t } = useTranslation();
  const [initialProgress] = useState(readCheckoutProgress);
  const recoveryStoreRef = useRef<CheckoutRecoveryStore | null>(null);
  if (!recoveryStoreRef.current) {
    recoveryStoreRef.current = createCheckoutRecoveryStore(sessionStorage);
  }
  const recoveryStore = recoveryStoreRef.current;
  const controllerRef = useRef<CheckoutSubmissionController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = createCheckoutSubmissionController({
      placeOrder,
      findOrderByIdempotencyKey,
      codConfirm,
      vnpayCreate,
      momoCreate,
      vietqrCreate,
      stripeCreate,
      paypalCreate,
      recovery: recoveryStore,
      newKey: () => crypto.randomUUID(),
      now: () => Date.now(),
      sleep: (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds)),
    });
  }
  const controller = controllerRef.current;
  const subscribeToController = useCallback(
    (onStoreChange: () => void) => controller.subscribe(onStoreChange),
    [controller],
  );
  const getControllerState = useCallback(() => controller.getState(), [controller]);
  const submission = useSyncExternalStore(
    subscribeToController,
    getControllerState,
    getControllerState,
  );

  // Profile + addresses (best-effort — backend may not return addresses yet).
  const profileQuery = useQuery({
    queryKey: ["users", "me"],
    queryFn: myProfile,
    enabled: ready && authenticated,
  });
  const addresses: Address[] = profileQuery.data?.addresses ?? [];

  const paymentQuery = useQuery({
    queryKey: ["checkout", "payment-methods"],
    queryFn: fetchPaymentMethods,
    enabled: ready && authenticated,
    retry: false,
  });

  // shippingOptions moved after ratesQuery declaration below

  const paymentOptions: PaymentOption[] = useMemo(
    () => toPaymentOptions(paymentQuery.data, t),
    [paymentQuery.data, t],
  );

  const [step, setStep] = useState<Step>(() => initialProgress?.step ?? "address");
  const [selectedAddressIndex, setSelectedAddressIndex] = useState<number>(
    () => initialProgress?.selectedAddressIndex ?? 0,
  );
  // The user's explicit shipping pick. Empty string means "use default" — we resolve
  // to the first available option at render time, so we never need an effect to
  // mirror server-provided defaults into local state.
  const [shippingChoice, setShippingChoice] = useState<string>(
    () => initialProgress?.shippingChoice ?? "STANDARD",
  );
  const selectedShippingId = shippingChoice === "STANDARD" ? shippingChoice : "STANDARD";
  const [selectedPaymentId, setSelectedPaymentId] = useState<PaymentOption["id"]>(
    () => initialProgress?.selectedPaymentId ?? "VNPAY",
  );

  useEffect(() => {
    if (
      paymentOptions.length > 0 &&
      !paymentOptions.some((option) => option.id === selectedPaymentId)
    ) {
      setSelectedPaymentId(paymentOptions[0].id);
    }
  }, [paymentOptions, selectedPaymentId]);
  const [note, setNote] = useState<string>(() => initialProgress?.note ?? "");
  const [couponInput, setCouponInput] = useState<string>("");

  // Persist checkout progress so a page refresh doesn't lose the user's place.
  useEffect(() => {
    if (step === "success") {
      try {
        sessionStorage.removeItem("vnshop:checkout-state");
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      sessionStorage.setItem(
        "vnshop:checkout-state",
        JSON.stringify({ step, selectedAddressIndex, shippingChoice, selectedPaymentId, note }),
      );
    } catch {
      /* ignore */
    }
  }, [step, selectedAddressIndex, shippingChoice, selectedPaymentId, note]);
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [showCouponPicker, setShowCouponPicker] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  // Preserve the server-authoritative total after the cart is cleared.
  const [placedOrderTotal, setPlacedOrderTotal] = useState<number | null>(null);
  const hasPaymentCapability = paymentOptions.some((option) => option.id === selectedPaymentId);
  const cartFingerprint = useMemo(
    () =>
      cartItems
        .map((item) => `${item.productId}:${item.variantId ?? ""}:${item.quantity}`)
        .sort()
        .join("|"),
    [cartItems],
  );
  const isProcessing = ["placing", "reconciling", "payment-initializing"].includes(
    submission.status,
  );
  const recovery = recoveryStore.read();
  const recoveryResumeRef = useRef<string | null>(null);

  useEffect(() => {
    controller.updateCartFingerprint(cartFingerprint);
  }, [cartFingerprint, controller]);

  useEffect(() => {
    if (recovery?.phase !== "order" || recoveryResumeRef.current === recovery.orderKey) return;
    recoveryResumeRef.current = recovery.orderKey;
    void controller.resume();
  }, [controller, recovery]);

  useEffect(() => {
    if (!("orderId" in submission)) return;
    setPlacedOrderId(submission.orderId);
    setPlacedOrderTotal(submission.total);
  }, [submission]);

  const selectedAddress = addresses[selectedAddressIndex];
  const shippingOptions = useMemo(() => {
    // The current POST /orders contract does not accept a shipping fee or
    // method, and new SubOrders persist ShippingInfo.EMPTY. Keep checkout's
    // visible choice on that same zero-fee STANDARD contract until carrier
    // rates become part of the authoritative order command.
    return [
      {
        id: "STANDARD",
        name: t("checkout.shipping.standardName"),
        desc: t("checkout.shipping.fallbackStandard.desc"),
        fee: 0,
        eta: t("checkout.shipping.fallbackStandard.eta"),
      },
    ];
  }, [t]);

  // Lazily fetch the public coupon catalogue when the user opens the picker.
  // No `enabled` gate would mean every checkout view paid the call even if
  // the user typed a code by hand or skipped coupons entirely.
  const couponsQuery = useQuery({
    queryKey: ["checkout", "active-coupons"],
    queryFn: listActiveCoupons,
    enabled: showCouponPicker,
    staleTime: 60_000,
  });

  // Server-side preview of totals — best effort. UI falls back to local sum if unavailable.
  const calcQuery = useQuery({
    queryKey: [
      "checkout",
      "calculate",
      cartItems.map((i) => `${i.productId}:${i.variantId ?? ""}:${i.quantity}`).join(","),
      addresses[selectedAddressIndex]?.street,
      appliedCoupon,
    ],
    queryFn: () =>
      calculateCheckout({
        items: cartItems.map((i) => ({
          productId: i.productId,
          variantSku: i.variantId,
          quantity: i.quantity,
        })),
        couponCode: appliedCoupon ?? undefined,
      }),
    enabled: cartItems.length > 0,
    retry: false,
  });

  const shipping = shippingOptions.find((m) => m.id === selectedShippingId) ?? shippingOptions[0];
  // The placed-order contract currently persists zero sub-order shipping and
  // adds server-calculated VAT. Use the preview breakdown as the source of
  // truth so the amount shown here is the amount the order service places.
  const subtotal = calcQuery.data?.subtotal ?? totalAmount;
  const shippingFee = calcQuery.data?.shippingFee ?? 0;
  const discount = calcQuery.data?.discount ?? 0;
  const tax = calcQuery.data?.tax ?? 0;
  const finalTotal = calcQuery.data?.total ?? Math.max(0, subtotal + shippingFee - discount + tax);

  const stepOrder: Step[] = ["address", "shipping", "payment", "review", "success"];
  const stepIdx = stepOrder.indexOf(step);

  const buyerName =
    [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") ||
    profile?.username ||
    profile?.email ||
    t("checkout.buyerFallback");

  const couponMutation = useMutation({
    mutationFn: validateCouponCode,
    onSuccess: (result, variables) => {
      if (result.valid) {
        setAppliedCoupon(variables.code);
        setCouponInput("");
        return;
      }
      toast.error(result.message || t("checkout.summary.couponInvalid"));
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : t("checkout.summary.couponInvalid"));
    },
  });

  const handleApplyCoupon = () => {
    const code = couponInput.trim();
    if (!code || couponMutation.isPending) return;
    couponMutation.mutate({ code, orderAmount: subtotal });
  };

  const handlePickCoupon = (code: string) => {
    setCouponInput(code);
    setShowCouponPicker(false);
    if (!couponMutation.isPending) {
      couponMutation.mutate({ code, orderAmount: subtotal });
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    couponMutation.reset();
  };

  if (!ready) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center text-sm text-muted-foreground">
        {t("checkout.initSession")}
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <h2 className="text-xl font-bold text-muted-foreground mb-3">
          {t("checkout.loginPromptTitle")}
        </h2>
        <button
          onClick={() => login("/checkout")}
          className="px-8 py-3 rounded-[var(--radius-lg)] bg-primary text-white font-semibold inline-flex items-center gap-2"
        >
          <LogIn size={16} /> {t("auth.login")}
        </button>
      </div>
    );
  }

  if (cartLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center text-sm text-muted-foreground">
        {t("checkout.loadingCart")}
      </div>
    );
  }

  const showsRecovery =
    (recovery !== null && submission.status === "draft") ||
    ["reconciling", "uncertain", "failed", "pending"].includes(submission.status);

  if (cartItems.length === 0 && step !== "success" && !showsRecovery) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <Package size={56} className="mx-auto mb-4 text-muted-foreground/30" />
        <h2 className="text-xl font-bold text-muted-foreground mb-3">
          {t("checkout.emptyCartTitle")}
        </h2>
        <button
          onClick={() => navigate("/")}
          className="px-6 py-2.5 rounded-[var(--radius-lg)] bg-primary text-white font-medium"
        >
          {t("checkout.continueShopping")}
        </button>
      </div>
    );
  }

  const handlePlaceOrder = async () => {
    if (!hasPaymentCapability) {
      toast.error(t("checkout.payment.unavailable"));
      return;
    }
    if (!selectedAddress) {
      toast.error(t("checkout.address.missingValidation"));
      return;
    }

    let result: CheckoutSubmissionResult;
    try {
      result = await controller.submit({
        provider: selectedPaymentId,
        order: {
          items: cartItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            variantSku: item.variantId,
          })),
          shippingAddress: {
            street: selectedAddress.street,
            ward: selectedAddress.ward ?? undefined,
            district: selectedAddress.district ?? "",
            city: selectedAddress.city,
          },
          paymentMethod: selectedPaymentId,
          notes: note || undefined,
          couponCode: appliedCoupon ?? undefined,
        },
      });
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : t("checkout.payment.placeOrderFailed"),
      );
      return;
    }

    if (result.orderId) {
      setPlacedOrderId(result.orderId);
      if ("total" in result.state) setPlacedOrderTotal(result.state.total);
    }
    const purchasedItems = "purchasedItems" in result.state ? result.state.purchasedItems : [];

    if (result.redirectUrl) {
      const persisted = recoveryStore.read();
      if (
        result.state.status !== "pending" ||
        result.state.providerState.kind !== "redirect" ||
        persisted?.phase !== "redirect"
      ) {
        toast.error(t("checkout.payment.initFailedShort"));
        return;
      }
      if (
        persisted.orderId !== result.state.orderId ||
        persisted.paymentId !== result.state.paymentId
      ) {
        toast.error(t("checkout.payment.initFailedShort"));
        return;
      }
      await cleanupThenRedirect(result.redirectUrl, purchasedItems, removePurchasedItems, (url) =>
        window.location.assign(url),
      );
      return;
    }

    if (shouldClearCartAfterSubmission(result)) {
      await removePurchasedItems(purchasedItems);
    }
    if (result.state.status === "completed") setStep("success");
    if (result.state.status === "failed") toast.error(result.state.message);
  };

  const handleNext = () => {
    if (step === "address") {
      if (
        addresses.length === 0 ||
        selectedAddressIndex < 0 ||
        selectedAddressIndex >= addresses.length
      ) {
        toast.error(t("checkout.address.missingValidation"), {
          description: t("checkout.address.addAddressHint"),
          action: {
            label: t("checkout.address.openProfile"),
            onClick: () => window.open("/profile", "_blank"),
          },
        });
        return;
      }
      setStep("shipping");
      return;
    }
    if (step === "shipping") {
      if (!selectedShippingId) {
        toast.error(t("checkout.shipping.missingValidation"));
        return;
      }
      setStep("payment");
      return;
    }
    if (step === "payment") {
      if (!hasPaymentCapability) {
        toast.error(t("checkout.payment.unavailable"));
        return;
      }
      setStep("review");
      return;
    }
    if (step === "review") {
      void handlePlaceOrder();
    }
  };

  if (showsRecovery) {
    const activeOrderId =
      "orderId" in submission
        ? submission.orderId
        : recovery && "orderId" in recovery
          ? recovery.orderId
          : undefined;
    return (
      <CheckoutPaymentRecovery
        recovery={recovery}
        submission={submission}
        onResume={async () => {
          try {
            const result = await controller.resume();
            if (result.redirectUrl) {
              const persisted = recoveryStore.read();
              if (
                result.state.status === "pending" &&
                result.state.providerState.kind === "redirect" &&
                persisted?.phase === "redirect" &&
                persisted.orderId === result.state.orderId &&
                persisted.paymentId === result.state.paymentId
              ) {
                await cleanupThenRedirect(
                  result.redirectUrl,
                  "purchasedItems" in result.state ? result.state.purchasedItems : [],
                  removePurchasedItems,
                  (url) => window.location.assign(url),
                );
                return;
              }
              toast.error(t("checkout.payment.initFailedShort"));
              return;
            }
            if (shouldClearCartAfterSubmission(result)) {
              await removePurchasedItems(
                "purchasedItems" in result.state ? result.state.purchasedItems : [],
              );
            }
            if (result.state.status === "completed") setStep("success");
          } catch {
            toast.error(t("checkout.payment.initFailedShort"));
          }
        }}
        onViewOrder={(orderId) => {
          void navigate(orderId ? `/orders/${orderId}` : "/orders");
        }}
        onContinueRedirect={async (url) => {
          const persisted = recoveryStore.read();
          if (
            submission.status !== "pending" ||
            submission.providerState.kind !== "redirect" ||
            persisted?.phase !== "redirect"
          ) {
            toast.error(t("checkout.payment.initFailedShort"));
            return;
          }
          if (
            persisted.orderId !== submission.orderId ||
            persisted.paymentId !== submission.paymentId
          ) {
            toast.error(t("checkout.payment.initFailedShort"));
            return;
          }
          await cleanupThenRedirect(
            url,
            submission.purchasedItems,
            removePurchasedItems,
            (redirectUrl) => window.location.assign(redirectUrl),
          );
        }}
        onPaymentCompleted={async () => {
          const purchasedItems =
            "purchasedItems" in submission
              ? submission.purchasedItems
              : recovery && "purchasedItems" in recovery
                ? recovery.purchasedItems
                : [];
          await removePurchasedItems(purchasedItems);
          recoveryStore.clear();
          void navigate(activeOrderId ? `/orders/${activeOrderId}` : "/orders");
        }}
      />
    );
  }

  if (step === "success") {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <CheckoutSuccess
          placedOrderId={placedOrderId}
          selectedPaymentId={selectedPaymentId}
          finalTotal={placedOrderTotal ?? finalTotal}
        />
      </div>
    );
  }

  return (
    <CheckoutPageView
      step={step}
      onBack={() => (step === "address" ? navigate("/cart") : setStep(stepOrder[stepIdx - 1]))}
      stepper={<CheckoutStepper step={step} onStepChange={setStep} />}
      stage={
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            {step === "address" ? (
              <CheckoutAddressStep
                addresses={addresses}
                selectedAddressIndex={selectedAddressIndex}
                setSelectedAddressIndex={setSelectedAddressIndex}
                buyerName={buyerName}
                isLoading={profileQuery.isLoading}
                refetchAddresses={profileQuery.refetch}
              />
            ) : null}

            {step === "shipping" ? (
              <CheckoutShippingStep
                shippingOptions={shippingOptions}
                selectedShippingId={selectedShippingId}
                setShippingChoice={setShippingChoice}
                note={note}
                setNote={setNote}
                isLoadingRates={false}
                subtotal={subtotal}
              />
            ) : null}

            {step === "payment" ? (
              <CheckoutPaymentStep
                paymentOptions={paymentOptions}
                selectedPaymentId={selectedPaymentId}
                setSelectedPaymentId={setSelectedPaymentId}
                loadError={paymentQuery.error instanceof Error ? paymentQuery.error : null}
                onRetry={() => void paymentQuery.refetch()}
              />
            ) : null}

            {step === "review" ? (
              <CheckoutReviewStep
                addresses={addresses}
                selectedAddressIndex={selectedAddressIndex}
                shipping={shipping}
                paymentOptions={paymentOptions}
                selectedPaymentId={selectedPaymentId}
                cartItems={cartItems}
                buyerName={buyerName}
                isProcessing={isProcessing}
                setStep={setStep}
              />
            ) : null}
          </motion.div>
        </AnimatePresence>
      }
      summary={
        <CheckoutSummary
          cartItems={cartItems}
          subtotal={subtotal}
          shippingFee={shippingFee}
          tax={tax}
          discount={discount}
          finalTotal={finalTotal}
          step={step}
          isProcessing={isProcessing}
          canSubmit={step === "review" ? hasPaymentCapability : true}
          addresses={addresses}
          appliedCoupon={appliedCoupon}
          couponInput={couponInput}
          setCouponInput={setCouponInput}
          showCouponPicker={showCouponPicker}
          setShowCouponPicker={setShowCouponPicker}
          couponsQuery={couponsQuery}
          couponMutation={couponMutation}
          handleApplyCoupon={handleApplyCoupon}
          handlePickCoupon={handlePickCoupon}
          handleRemoveCoupon={handleRemoveCoupon}
          handleNext={handleNext}
        />
      }
    />
  );
}
