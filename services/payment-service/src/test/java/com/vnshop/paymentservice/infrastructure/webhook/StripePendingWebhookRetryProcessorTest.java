package com.vnshop.paymentservice.infrastructure.webhook;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.paymentservice.application.PaymentPromotionService;
import com.vnshop.paymentservice.application.chargeback.ChargebackService;
import com.vnshop.paymentservice.domain.Chargeback;
import com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackAttempt;
import com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackLogStore;
import java.util.UUID;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.eq;

class StripePendingWebhookRetryProcessorTest {
    private static final UUID PAYMENT_ID = UUID.fromString("00000000-0000-0000-0000-0000000000aa");

    @Test
    void processesOnlyPayloadMatchingThePendingWebhookIdentity() {
        PaymentPromotionService promotionService = mock(PaymentPromotionService.class);
        PaymentCallbackLogStore callbackLogStore = mock(PaymentCallbackLogStore.class);
        WebhookIdempotencyService idempotencyService = mock(WebhookIdempotencyService.class);
        ChargebackService chargebackService = mock(ChargebackService.class);
        PaymentPromotionService.PromotionResult promoted = new PaymentPromotionService.PromotionResult(
                PaymentPromotionService.PromotionResult.Outcome.PROMOTED, null);
        when(callbackLogStore.save(any(PaymentCallbackAttempt.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(promotionService.promote(any(PaymentPromotionService.PromotionCommand.class))).thenReturn(promoted);

        StripePendingWebhookRetryProcessor processor = new StripePendingWebhookRetryProcessor(
                promotionService, callbackLogStore, new ObjectMapper(), idempotencyService, chargebackService);

        processor.process(new PendingWebhookRetryEvent(
                UUID.randomUUID(), "evt_retry", "STRIPE", "payment_intent.succeeded", payload("evt_retry")));

        verify(promotionService).promote(any(PaymentPromotionService.PromotionCommand.class));
        verify(idempotencyService).markProcessed("evt_retry", "STRIPE", "payment_intent.succeeded");
        verify(callbackLogStore, org.mockito.Mockito.times(2)).save(any(PaymentCallbackAttempt.class));
    }

    @Test
    void rejectsPayloadWithDifferentWebhookIdentityBeforePromotion() {
        PaymentPromotionService promotionService = mock(PaymentPromotionService.class);
        PaymentCallbackLogStore callbackLogStore = mock(PaymentCallbackLogStore.class);
        WebhookIdempotencyService idempotencyService = mock(WebhookIdempotencyService.class);
        ChargebackService chargebackService = mock(ChargebackService.class);
        StripePendingWebhookRetryProcessor processor = new StripePendingWebhookRetryProcessor(
                promotionService, callbackLogStore, new ObjectMapper(), idempotencyService, chargebackService);

        assertThatThrownBy(() -> processor.process(new PendingWebhookRetryEvent(
                        UUID.randomUUID(), "evt_expected", "STRIPE", "payment_intent.succeeded", payload("evt_other"))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("identity");

        verify(promotionService, never()).promote(any(PaymentPromotionService.PromotionCommand.class));
        verify(callbackLogStore, never()).save(any(PaymentCallbackAttempt.class));
    }

    @Test
    void processesChargebackRetryThroughTheChargebackService() {
        PaymentPromotionService promotionService = mock(PaymentPromotionService.class);
        PaymentCallbackLogStore callbackLogStore = mock(PaymentCallbackLogStore.class);
        WebhookIdempotencyService idempotencyService = mock(WebhookIdempotencyService.class);
        ChargebackService chargebackService = mock(ChargebackService.class);
        StripePendingWebhookRetryProcessor processor = new StripePendingWebhookRetryProcessor(
                promotionService, callbackLogStore, new ObjectMapper(), idempotencyService, chargebackService);

        processor.process(new PendingWebhookRetryEvent(
                UUID.randomUUID(), "evt_dispute_retry", "STRIPE", "charge.dispute.created",
                disputePayload("evt_dispute_retry")));

        verify(chargebackService).createFromWebhook(
                eq("ORDER-123"), eq("dp_123"), eq(Chargeback.ChargebackProvider.STRIPE),
                eq("fraudulent"), any(), eq(new java.math.BigDecimal("1250.00")), eq("USD"), eq("pi_123"));
        verify(idempotencyService).markProcessed("evt_dispute_retry", "STRIPE", "charge.dispute.created");
        verify(promotionService, never()).promote(any(PaymentPromotionService.PromotionCommand.class));
        verify(callbackLogStore, never()).save(any(PaymentCallbackAttempt.class));
    }

    private static String payload(String eventId) {
        return "{" +
                "\"id\":\"" + eventId + "\"," +
                "\"object\":\"event\"," +
                "\"type\":\"payment_intent.succeeded\"," +
                "\"data\":{" +
                "\"object\":{" +
                "\"object\":\"payment_intent\"," +
                "\"id\":\"pi_retry\"," +
                "\"metadata\":{" +
                "\"paymentId\":\"" + PAYMENT_ID + "\"," +
                "\"orderId\":\"ORDER-" + PAYMENT_ID + "\"," +
                "\"vndAmount\":\"100000\"}," +
                "\"amount\":10000," +
                "\"currency\":\"usd\"}}}}";
    }

    private static String disputePayload(String eventId) {
        return "{" +
                "\"id\":\"" + eventId + "\"," +
                "\"object\":\"event\"," +
                "\"type\":\"charge.dispute.created\"," +
                "\"data\":{" +
                "\"object\":{" +
                "\"object\":\"dispute\"," +
                "\"id\":\"dp_123\"," +
                "\"amount\":125000," +
                "\"currency\":\"usd\"," +
                "\"reason\":\"fraudulent\"," +
                "\"payment_intent\":\"pi_123\"," +
                "\"metadata\":{\"orderId\":\"ORDER-123\"}," +
                "\"evidence_details\":{\"due_by\":4102444800}}}}";
    }
}
