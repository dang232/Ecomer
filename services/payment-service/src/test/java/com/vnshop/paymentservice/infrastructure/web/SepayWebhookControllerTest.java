package com.vnshop.paymentservice.infrastructure.web;

import com.vnshop.paymentservice.application.PaymentPromotionService;
import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.PaymentMethod;
import com.vnshop.paymentservice.domain.PaymentStatus;
import com.vnshop.paymentservice.domain.port.out.PaymentRepositoryPort;
import com.vnshop.paymentservice.infrastructure.sepay.SepayProperties;
import com.vnshop.paymentservice.infrastructure.sepay.SepayWebhookPayload;
import com.vnshop.paymentservice.infrastructure.web.SepayWebhookController.SepaySignatureException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;

class SepayWebhookControllerTest {
    private static final UUID PAYMENT_ID = UUID.fromString("00000000-0000-0000-0000-000000000551");

    @Test
    void underpaidWebhookIsRejectedWithoutPromotion() {
        PaymentRepositoryPort repository = mock(PaymentRepositoryPort.class);
        PaymentPromotionService promotion = mock(PaymentPromotionService.class);
        Payment payment = payment();
        org.mockito.Mockito.when(repository.findById(PAYMENT_ID)).thenReturn(Optional.of(payment));
        SepayWebhookController controller = controller(repository, promotion);

        ApiResponse<String> response = controller.handleWebhook("Apikey secret", payload(new BigDecimal("1000")));

        assertThat(response.data()).isEqualTo("amount_mismatch");
        verify(promotion, never()).promote(any());
    }

    @Test
    void exactAmountWebhookPromotesPayment() {
        PaymentRepositoryPort repository = mock(PaymentRepositoryPort.class);
        PaymentPromotionService promotion = mock(PaymentPromotionService.class);
        org.mockito.Mockito.when(repository.findById(PAYMENT_ID)).thenReturn(Optional.of(payment()));
        SepayWebhookController controller = controller(repository, promotion);

        ApiResponse<String> response = controller.handleWebhook("Apikey secret", payload(new BigDecimal("15000000.00")));

        assertThat(response.data()).isEqualTo("processed");
        verify(promotion).promote(any());
    }

    @Test
    void missingSignatureIsRejectedBeforeLookup() {
        PaymentRepositoryPort repository = mock(PaymentRepositoryPort.class);
        SepayWebhookController controller = controller(repository, mock(PaymentPromotionService.class));

        assertThatThrownBy(() -> controller.handleWebhook(null, payload(new BigDecimal("15000000"))))
                .isInstanceOf(SepaySignatureException.class);
        verify(repository, never()).findById(any());
    }

    private static SepayWebhookController controller(PaymentRepositoryPort repository, PaymentPromotionService promotion) {
        return new SepayWebhookController(
                new SepayProperties(true, "api", "account", "https://sepay.example", 30, "secret"),
                repository, new NoopCallbackLogStore(), promotion);
    }

    private static SepayWebhookPayload payload(BigDecimal amount) {
        return new SepayWebhookPayload("TX-551", "Payment " + PAYMENT_ID, amount, "account", "bank");
    }

    private static Payment payment() {
        return new Payment(PAYMENT_ID, "ORDER-551", "BUYER-1", new BigDecimal("15000000"),
                PaymentMethod.VIETQR, PaymentStatus.PENDING, null, Instant.parse("2026-05-19T00:00:00Z"));
    }

    private static final class NoopCallbackLogStore implements com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackLogStore {
        @Override
        public Optional<com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackAttempt> findProcessed(String provider, String eventId, String payloadHash, String signatureHash) {
            return Optional.empty();
        }

        @Override
        public com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackAttempt save(com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackAttempt attempt) {
            return attempt;
        }
    }
}
