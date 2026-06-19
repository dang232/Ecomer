import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, LogIn, Package } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

import { PayPalPaymentSection } from "../../components/checkout/PayPalPaymentSection";
import { StripePaymentSection } from "../../components/checkout/StripePaymentSection";
import { VietQrPaymentSection } from "../../components/checkout/VietQrPaymentSection";
import { useAuth } from "../../hooks/use-auth";
import { useCart } from "../../hooks/use-cart";
import { ApiError } from "../../lib/api";
import {
  calculateCheckout,
  fetchShippingRates,
  paymentMethods as fetchPaymentMethods,
  shippingOptions as fetchShippingOptions,
} from "../../lib/api/endpoints/checkout";
import { listActiveCoupons, validateCouponCode } from "../../lib/api/endpoints/coupons";
import { placeOrder } from "../../lib/api/endpoints/orders";
import { codConfirm, momoCreate, vnpayCreate } from "../../lib/api/endpoints/payment";
import { myProfile } from "../../lib/api/endpoints/users";
import type { Address } from "../../types/api";

import { CheckoutAddressStep } from "./CheckoutAddressStep";
import { CheckoutPaymentStep } from "./CheckoutPaymentStep";
import { CheckoutReviewStep } from "./CheckoutReviewStep";
import { CheckoutShippingStep } from "./CheckoutShippingStep";
import { CheckoutStepper } from "./CheckoutStepper";
import { CheckoutSuccess } from "./CheckoutSuccess";
import { CheckoutSummary } from "./CheckoutSummary";
import {
  makeFallbackShipping,
  mapPaymentOptions,
  type PaymentOption,
  type Step,
} from "./types";

export function CheckoutPage() {
  const navigate = useNavigate();
  const { ready, authenticated, login, profile } = useAuth();
  const { items: cartItems, totalAmount, isLoading: cartLoading, refetch: refetchCart } = useCart();
  const { t } = useTranslation();

  // Profile + addresses (best-effort — backend may not return addresses yet).
  const profileQuery = useQuery({
    queryKey: ["users", "me"],
    queryFn: myProfile,
    enabled: ready && authenticated,
  });
  const addresses: Address[] = profileQuery.data?.addresses ?? [];

  const shippingQuery = useQuery({
    queryKey: ["checkout", "shipping-options", cartItems.map((i) => i.productId).join(",")],
    queryFn: () =>
      fetchShippingOptions({
        items: cartItems.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      }),
    enabled: cartItems.length > 0,
    retry: false,
  });

  const paymentQuery = useQuery({
    queryKey: ["checkout", "payment-methods"],
    queryFn: fetchPaymentMethods,
    enabled: ready && authenticated,
    retry: false,
  });

  // shippingOptions moved after ratesQuery declaration below

  const paymentOptions: PaymentOption[] = useMemo(
    () => mapPaymentOptions(paymentQuery.data, t),
    [paymentQuery.data, t],
  );

  const [step, setStep] = useState<Step>(() => {
    try {
      const raw = sessionStorage.getItem("vnshop:checkout-state");
      if (raw) {
        const s = (JSON.parse(raw) as Record<string, unknown>).step;
        if (typeof s === "string") return s as Step;
      }
    } catch { /* ignore */ }
    return "address";
  });
  const [selectedAddressIndex, setSelectedAddressIndex] = useState<number>(() => {
    try {
      const raw = sessionStorage.getItem("vnshop:checkout-state");
      if (raw) {
        const v = (JSON.parse(raw) as Record<string, unknown>).selectedAddressIndex;
        if (typeof v === "number") return v;
      }
    } catch { /* ignore */ }
    return 0;
  });
  // The user's explicit shipping pick. Empty string means "use default" — we resolve
  // to the first available option at render time, so we never need an effect to
  // mirror server-provided defaults into local state.
  const [shippingChoice, setShippingChoice] = useState<string>(() => {
    try {
      const raw = sessionStorage.getItem("vnshop:checkout-state");
      if (raw) {
        const v = (JSON.parse(raw) as Record<string, unknown>).shippingChoice;
        if (typeof v === "string") return v;
      }
    } catch { /* ignore */ }
    return "";
  });
  const selectedShippingId = shippingChoice || "";
  const [selectedPaymentId, setSelectedPaymentId] = useState<PaymentOption["id"]>(() => {
    try {
      const raw = sessionStorage.getItem("vnshop:checkout-state");
      if (raw) {
        const v = (JSON.parse(raw) as Record<string, unknown>).selectedPaymentId;
        if (typeof v === "string") return v as PaymentOption["id"];
      }
    } catch { /* ignore */ }
    return "VNPAY";
  });
  const [note, setNote] = useState<string>(() => {
    try {
      const raw = sessionStorage.getItem("vnshop:checkout-state");
      if (raw) {
        const v = (JSON.parse(raw) as Record<string, unknown>).note;
        if (typeof v === "string") return v;
      }
    } catch { /* ignore */ }
    return "";
  });
  const [couponInput, setCouponInput] = useState<string>("");

  // Persist checkout progress so a page refresh doesn't lose the user's place.
  useEffect(() => {
    if (step === "success") {
      try { sessionStorage.removeItem("vnshop:checkout-state"); } catch { /* ignore */ }
      return;
    }
    try {
      sessionStorage.setItem(
        "vnshop:checkout-state",
        JSON.stringify({ step, selectedAddressIndex, shippingChoice, selectedPaymentId, note }),
      );
    } catch { /* ignore */ }
  }, [step, selectedAddressIndex, shippingChoice, selectedPaymentId, note]);
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [showCouponPicker, setShowCouponPicker] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);

  const selectedAddress = addresses[selectedAddressIndex];
  const ratesQuery = useQuery({
    queryKey: [
      "checkout",
      "shipping-rates",
      selectedAddress?.street,
      selectedAddress?.district,
      selectedAddress?.city,
      totalAmount,
    ],
    queryFn: () =>
      fetchShippingRates({
        street: selectedAddress.street,
        ward: selectedAddress.ward ?? undefined,
        district: selectedAddress.district ?? "",
        province: selectedAddress.city,
        orderTotalVnd: totalAmount,
      }),
    enabled: !!selectedAddress && cartItems.length > 0,
    retry: false,
  });

  const shippingOptions = useMemo(() => {
    const ratesData = ratesQuery.data?.options;
    if (ratesData && ratesData.length > 0) {
      return ratesData.map((r: { serviceCode: string; feeVnd: number; estimatedDeliveryTime: string }) => ({
        id: r.serviceCode,
        name: r.serviceCode === "STANDARD"
          ? t("checkout.shipping.standardName")
          : r.serviceCode === "EXPRESS"
            ? t("checkout.shipping.expressName")
            : r.serviceCode,
        desc: r.estimatedDeliveryTime,
        fee: r.feeVnd,
        eta: r.estimatedDeliveryTime,
      }));
    }
    const checkoutData = shippingQuery.data;
    if (checkoutData && checkoutData.length > 0) {
      return checkoutData.map((s, i) => ({
        id: s.code ?? `option-${i}`,
        name: s.name ?? t("checkout.shipping.fallbackName", { n: i + 1 }),
        desc:
          typeof s.estimatedDays === "number"
            ? t("checkout.shipping.deliverInDays", { n: s.estimatedDays })
            : t("checkout.shipping.etaStandard"),
        fee: s.fee ?? 0,
        eta:
          typeof s.estimatedDays === "number"
            ? t("checkout.shipping.etaDays", { n: s.estimatedDays })
            : t("checkout.shipping.etaStandard"),
      }));
    }
    return makeFallbackShipping(t);
  }, [ratesQuery.data, shippingQuery.data, t]);

  // Lazily fetch the public coupon catalogue when the user opens the picker.
  // No `enabled` gate would mean every checkout view paid the call even if
  // the user typed a code by hand or skipped coupons entirely.
  const couponsQuery = useQuery({
    queryKey: ["checkout", "active-coupons"],
    queryFn: listActiveCoupons,
    enabled: showCouponPicker,
    staleTime: 60_000,
  });

  // Idempotency key generated once per checkout attempt; reused on retries.
  const idempotencyKeyRef = useRef<string>("");
  if (!idempotencyKeyRef.current) idempotencyKeyRef.current = uuidv4();

  // Track whether a payment flow is active — suppress key regeneration during it.
  const paymentInFlightRef = useRef(false);

  // Regenerate idempotency key when cart contents change so a fresh order
  // attempt after a cart edit does not reuse a stale key.
  // Never regenerate while a payment flow is in progress (prevents race with refetchCart).
  useEffect(() => {
    if (!paymentInFlightRef.current) {
      idempotencyKeyRef.current = uuidv4();
    }
  }, [cartItems]);

  // Server-side preview of totals — best effort. UI falls back to local sum if unavailable.
  const calcQuery = useQuery({
    queryKey: [
      "checkout",
      "calculate",
      cartItems.map((i) => `${i.productId}:${i.quantity}`).join(","),
      addresses[selectedAddressIndex]?.street,
      appliedCoupon,
    ],
    queryFn: () =>
      calculateCheckout({
        items: cartItems.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        couponCode: appliedCoupon ?? undefined,
      }),
    enabled: cartItems.length > 0,
    retry: false,
  });

  const shipping = shippingOptions.find((m) => m.id === selectedShippingId) ?? shippingOptions[0];
  // Shipping fee is computed client-side from the selected option. The BE
  // /checkout/calculate endpoint does not currently accept shipping choices, so
  // its `shippingFee` reflects a single default. Using the client-selected fee
  // keeps the total in sync when the user toggles shipping options. We still
  // pull `subtotal` and `discount` from the BE so server-authoritative coupon
  // pricing wins.
  const subtotal = calcQuery.data?.subtotal ?? totalAmount;
  const shippingFee = shipping?.fee ?? 0;
  const discount = calcQuery.data?.discount ?? 0;
  const finalTotal = Math.max(0, subtotal - discount) + shippingFee;

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
        <h2 className="text-xl font-bold text-muted-foreground mb-3">{t("checkout.loginPromptTitle")}</h2>
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

  if (cartItems.length === 0 && step !== "success") {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <Package size={56} className="mx-auto mb-4 text-muted-foreground/30" />
        <h2 className="text-xl font-bold text-muted-foreground mb-3">{t("checkout.emptyCartTitle")}</h2>
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
    setIsProcessing(true);
    paymentInFlightRef.current = true;
    // Freeze the key — all calls in this payment flow use exactly this value.
    const frozenKey = idempotencyKeyRef.current;
    try {
      if (!selectedAddress) {
        toast.error(t("checkout.address.missingValidation"));
        setIsProcessing(false);
        paymentInFlightRef.current = false;
        return;
      }
      const order = await placeOrder(
        {
          items: cartItems.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          shippingAddress: {
            street: selectedAddress.street,
            ward: selectedAddress.ward ?? undefined,
            district: selectedAddress.district ?? "",
            city: selectedAddress.city,
          },
          paymentMethod: selectedPaymentId,
          notes: note || undefined,
          shippingChoices: shipping ? [{ sellerId: "_", code: shipping.id }] : undefined,
          couponCode: appliedCoupon ?? undefined,
        },
        frozenKey,
      );

      setPlacedOrderId(order.id);
      // Clear cart on the client — server typically clears too. Refetch to reconcile.
      void refetchCart();

      // Payment dispatch
      if (selectedPaymentId === "VNPAY" || selectedPaymentId === "MOMO") {
        try {
          const init =
            selectedPaymentId === "VNPAY"
              ? await vnpayCreate(
                  {
                    orderId: order.id,
                    returnUrl: `${window.location.origin}/payment/return/vnpay`,
                  },
                  frozenKey,
                )
              : await momoCreate(
                  {
                    orderId: order.id,
                    returnUrl: `${window.location.origin}/payment/return/momo`,
                  },
                  frozenKey,
                );
          if (init.redirectUrl) {
            window.location.href = init.redirectUrl;
            return;
          }
          // Gateway didn't return a redirect URL — payment creation failed silently.
          // Stay on review step so the buyer can retry instead of landing on success.
          toast.error(t("checkout.payment.initFailedShort"), {
            description: t("checkout.payment.retryHint", {
              defaultValue: "Your order was placed. You can retry payment or pay later from Orders.",
            }),
          });
          setPlacedOrderId(order.id);
          return;
        } catch (err) {
          toast.error(
            err instanceof ApiError
              ? t("checkout.payment.initFailedPrefix", { message: err.message })
              : t("checkout.payment.initFailedShort"),
          );
          // Order exists but payment init failed — stay on review with retry option.
          setPlacedOrderId(order.id);
          return;
        }
      } else if (selectedPaymentId === "COD") {
        try {
          await codConfirm({ orderId: order.id }, frozenKey);
        } catch {
          // COD confirmation is best-effort; buyer will see status update later.
        }
      } else if (
        selectedPaymentId === "STRIPE" ||
        selectedPaymentId === "PAYPAL" ||
        selectedPaymentId === "VIETQR"
      ) {
        // Order is placed; the inline section (rendered on the success screen)
        // drives the actual payment via SDK / QR scan + poll.
        setStep("success");
        return;
      }

      setStep("success");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t("checkout.payment.placeOrderFailed");
      toast.error(message, {
        description:
          err instanceof ApiError && err.correlationId
            ? t("checkout.payment.supportCode", { id: err.correlationId })
            : undefined,
      });
    } finally {
      setIsProcessing(false);
      paymentInFlightRef.current = false;
      // Regenerate key for the NEXT attempt (if user retries after failure).
      idempotencyKeyRef.current = uuidv4();
    }
  };

  const handleNext = () => {
    if (step === "address") {
      if (addresses.length === 0 || selectedAddressIndex < 0 || selectedAddressIndex >= addresses.length) {
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
      setStep("review");
      return;
    }
    if (step === "review") {
      void handlePlaceOrder();
    }
  };

  if (step === "success") {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        {placedOrderId &&
        (selectedPaymentId === "STRIPE" ||
          selectedPaymentId === "PAYPAL" ||
          selectedPaymentId === "VIETQR") ? (
          <div className="mb-6 rounded-[var(--radius-xl)] border-2 border-border bg-card p-6">
            <h2 className="text-lg font-bold text-foreground mb-4">
              {t("checkout.payment.complete", { id: placedOrderId })}
            </h2>
            {selectedPaymentId === "STRIPE" ? (
              <StripePaymentSection
                orderId={placedOrderId}
                idempotencyKey={idempotencyKeyRef.current}
                onCompleted={() => navigate(`/orders/${placedOrderId}`)}
              />
            ) : null}
            {selectedPaymentId === "PAYPAL" ? (
              <PayPalPaymentSection
                orderId={placedOrderId}
                idempotencyKey={idempotencyKeyRef.current}
                onCompleted={() => navigate(`/orders/${placedOrderId}`)}
              />
            ) : null}
            {selectedPaymentId === "VIETQR" ? (
              <VietQrPaymentSection
                orderId={placedOrderId}
                idempotencyKey={idempotencyKeyRef.current}
                onCompleted={() => navigate(`/orders/${placedOrderId}`)}
              />
            ) : null}
          </div>
        ) : null}
        <CheckoutSuccess
          placedOrderId={placedOrderId}
          selectedPaymentId={selectedPaymentId}
          finalTotal={finalTotal}
        />
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto py-8 px-[var(--content-padding,1.5rem)]">
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => (step === "address" ? navigate("/cart") : setStep(stepOrder[stepIdx - 1]))}
          className="p-2 rounded-[var(--radius-lg)] hover:bg-card text-muted-foreground"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-foreground">{t("checkout.title")}</h1>
      </div>

      {/* Stepper */}
      <CheckoutStepper step={step} onStepChange={setStep} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
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
                isLoadingRates={ratesQuery.isLoading}
                subtotal={subtotal}
              />
            ) : null}

            {step === "payment" ? (
              <CheckoutPaymentStep
                paymentOptions={paymentOptions}
                selectedPaymentId={selectedPaymentId}
                setSelectedPaymentId={setSelectedPaymentId}
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

        <CheckoutSummary
          cartItems={cartItems}
          subtotal={subtotal}
          shippingFee={shippingFee}
          discount={discount}
          finalTotal={finalTotal}
          step={step}
          isProcessing={isProcessing}
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
      </div>
    </div>
  );
}
