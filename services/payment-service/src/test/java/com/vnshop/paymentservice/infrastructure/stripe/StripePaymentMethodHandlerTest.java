package com.vnshop.paymentservice.infrastructure.stripe;

import static org.assertj.core.api.Assertions.assertThat;

import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.PaymentMethod;
import com.vnshop.paymentservice.domain.PaymentStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class StripePaymentMethodHandlerTest {
    @Test
    void leavesProviderReferenceForStripeIntentCreation() {
        Payment payment = new Payment(
                UUID.randomUUID(),
                "ORDER-1",
                "BUYER-1",
                new BigDecimal("100000"),
                PaymentMethod.STRIPE,
                PaymentStatus.PENDING,
                null,
                Instant.parse("2026-07-30T10:00:00Z"));

        var result = new StripePaymentMethodHandler().processPayment(payment);

        assertThat(result.status()).isEqualTo(PaymentStatus.PENDING);
        assertThat(result.transactionRef()).isNull();
    }
}
