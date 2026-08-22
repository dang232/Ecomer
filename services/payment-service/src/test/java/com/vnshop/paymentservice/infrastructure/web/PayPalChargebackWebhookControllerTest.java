package com.vnshop.paymentservice.infrastructure.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.paymentservice.application.chargeback.ChargebackService;
import com.vnshop.paymentservice.domain.Chargeback;
import com.vnshop.paymentservice.infrastructure.paypal.PayPalWebhookVerifier;
import com.vnshop.paymentservice.infrastructure.webhook.WebhookIdempotencyService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class PayPalChargebackWebhookControllerTest {
    private static final String PAYLOAD = "{\"id\":\"evt-1\",\"event_type\":\"CUSTOMER.DISPUTE.CREATED\",\"resource\":{}}";

    @Test
    void forgedEventIsRejectedBeforeAnySideEffect() {
        ChargebackService chargebackService = mock(ChargebackService.class);
        WebhookIdempotencyService idempotency = mock(WebhookIdempotencyService.class);
        PayPalChargebackWebhookController controller = controller(chargebackService, idempotency,
                (headers, webhookId, rawPayload) -> PayPalWebhookVerifier.PayPalWebhookVerificationResult.REJECTED,
                "webhook-1");

        ResponseEntity<ApiResponse<PayPalChargebackWebhookController.ChargebackWebhookResponse>> response =
                invoke(controller);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().errorCode()).isEqualTo("BAD_SIGNATURE");
        verify(chargebackService, never()).createFromWebhook(any(), any(), any(), any(), any(), any(), any(), any());
        verify(idempotency, never()).isAlreadyProcessed(any(), eq("PAYPAL"));
        verify(idempotency, never()).storePendingForRetry(any(), eq("PAYPAL"), any(), any());
        verify(idempotency, never()).markProcessed(any(), eq("PAYPAL"), any());
    }

    @Test
    void missingWebhookConfigurationIsRejectedBeforeVerification() {
        ChargebackService chargebackService = mock(ChargebackService.class);
        WebhookIdempotencyService idempotency = mock(WebhookIdempotencyService.class);
        PayPalChargebackWebhookController controller = controller(chargebackService, idempotency,
                (headers, webhookId, rawPayload) -> {
                    throw new AssertionError("verification must not run without webhook configuration");
                }, "");

        ResponseEntity<ApiResponse<PayPalChargebackWebhookController.ChargebackWebhookResponse>> response =
                invoke(controller);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.getBody().errorCode()).isEqualTo("CONFIG_ERROR");
        verify(chargebackService, never()).createFromWebhook(any(), any(), any(), any(), any(), any(), any(), any());
        verify(idempotency, never()).isAlreadyProcessed(any(), eq("PAYPAL"));
    }

    @Test
    void verifiedEventKeepsExistingProcessingAndIdempotencyFlow() {
        ChargebackService chargebackService = mock(ChargebackService.class);
        WebhookIdempotencyService idempotency = mock(WebhookIdempotencyService.class);
        UUID chargebackId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        Chargeback chargeback = new Chargeback(chargebackId, "ORDER-1", "UNKNOWN",
                Chargeback.ChargebackProvider.PAYPAL, "unspecified", Chargeback.ChargebackStatus.OPEN,
                null, null, null, "VND", null, Instant.now(), Instant.now());
        org.mockito.Mockito.when(chargebackService.createFromWebhook(
                eq("UNKNOWN"), eq("UNKNOWN"), eq(Chargeback.ChargebackProvider.PAYPAL),
                eq("unspecified"), eq(null), eq(null), eq("VND"), eq(null))).thenReturn(chargeback);

        PayPalChargebackWebhookController controller = controller(chargebackService, idempotency,
                (headers, webhookId, rawPayload) -> PayPalWebhookVerifier.PayPalWebhookVerificationResult.VERIFIED,
                "webhook-1");

        ResponseEntity<ApiResponse<PayPalChargebackWebhookController.ChargebackWebhookResponse>> response =
                invoke(controller);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().data().outcome()).isEqualTo(chargebackId.toString());
        verify(idempotency).markProcessed("evt-1", "PAYPAL", "CUSTOMER.DISPUTE.CREATED");
    }

    private static PayPalChargebackWebhookController controller(ChargebackService chargebackService,
                                                                  WebhookIdempotencyService idempotency,
                                                                  PayPalWebhookVerifier verifier,
                                                                  String webhookId) {
        PayPalChargebackWebhookController controller = new PayPalChargebackWebhookController(
                chargebackService, idempotency, verifier, new ObjectMapper());
        org.springframework.test.util.ReflectionTestUtils.setField(controller, "paypalWebhookId", webhookId);
        return controller;
    }

    private static ResponseEntity<ApiResponse<PayPalChargebackWebhookController.ChargebackWebhookResponse>> invoke(
            PayPalChargebackWebhookController controller) {
        return controller.chargebackWebhook("SHA256withRSA", "https://paypal.test/cert", "transmission-1",
                "signature-1", "2026-08-22T00:00:00Z", PAYLOAD);
    }
}
