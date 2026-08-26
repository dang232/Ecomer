package com.vnshop.paymentservice.infrastructure.sepay;

import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.PaymentMethod;
import com.vnshop.paymentservice.domain.PaymentStatus;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class SepayWebhookPollerParityTest {
    private static final UUID PAYMENT_ID = UUID.fromString("00000000-0000-0000-0000-000000000404");
    private final SepayTransactionValidator validator = new SepayTransactionValidator(
            new SepayProperties(true, "key", "ACCT-1", "https://sepay.example", 30, "secret", "HOLD"));

    @Test
    void webhookAndPollerUseTheSameStrictFinancialDecision() {
        Payment payment = new Payment(PAYMENT_ID, "ORDER-404", "BUYER-404", new BigDecimal("100000"),
                PaymentMethod.VIETQR, PaymentStatus.PENDING, null, Instant.parse("2026-08-25T00:00:00Z"));
        String memo = "VNShop payment " + PAYMENT_ID;

        assertThat(validator.validate(payment, "TX-404", "100000", memo, "ACCT-1", "VND", "CREDIT").accepted())
                .isTrue();
        assertThat(validator.validate(payment, "TX-404", "99999", memo, "ACCT-1", "VND", "CREDIT").accepted())
                .isFalse();
        assertThat(validator.validate(payment, "TX-404", "100000.0", memo, "ACCT-1", "VND", "CREDIT").accepted())
                .isFalse();
        assertThat(validator.validate(payment, "TX-404", "100001", memo, "ACCT-1", "VND", "CREDIT").accepted())
                .isFalse();
        assertThat(validator.validate(payment, "TX-404", "100001", memo, "ACCT-1", "VND", "CREDIT").held())
                .isTrue();
        assertThat(validator.validate(payment, "TX-404", "100000", memo, "ACCT-1", "USD", "CREDIT").accepted())
                .isFalse();
        assertThat(validator.validate(payment, "TX-404", "100000", memo, "ACCT-1", "VND", "DEBIT").accepted())
                .isFalse();
        assertThat(validator.validate(payment, "TX-404", "100000", memo, "ACCT-2", "VND", "CREDIT").accepted())
                .isFalse();
        assertThat(validator.validate(payment, "TX-404", "100000", "malformed", "ACCT-1", "VND", "CREDIT").accepted())
                .isFalse();
    }
}
