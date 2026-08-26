package com.vnshop.paymentservice.infrastructure.sepay;

import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.PaymentMethod;
import com.vnshop.paymentservice.domain.PaymentStatus;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class SepayTransactionValidatorTest {
    private static final UUID PAYMENT_ID = UUID.fromString("00000000-0000-0000-0000-000000000101");

    private final SepayTransactionValidator validator = new SepayTransactionValidator(
            new SepayProperties(true, "api-key", "ACCT-1", "https://sepay.example", 30, "secret"));

    @Test
    void acceptsMatchingVndCredit() {
        SepayTransactionValidator.Validation result = validator.validate(
                payment(), "TX-1", "100000", "payment " + PAYMENT_ID, "ACCT-1", "VND", "CREDIT");

        assertThat(result.accepted()).isTrue();
        assertThat(result.amount()).isEqualByComparingTo("100000");
    }

    @Test
    void rejectsWrongAmount() {
        assertRejected("99999", "VND", "CREDIT", "ACCT-1");
    }

    @Test
    void rejectsWrongCurrency() {
        assertRejected("100000", "USD", "CREDIT", "ACCT-1");
    }

    @Test
    void rejectsDebitDirection() {
        assertRejected("100000", "VND", "DEBIT", "ACCT-1");
    }

    @Test
    void rejectsWrongBeneficiaryAccount() {
        assertRejected("100000", "VND", "CREDIT", "ACCT-2");
    }

    @Test
    void rejectsNullFinancialFields() {
        assertRejected(null, "VND", "CREDIT", "ACCT-1");
        assertRejected("100000", null, "CREDIT", "ACCT-1");
        assertRejected("100000", "VND", null, "ACCT-1");
        assertRejected("100000", "VND", "CREDIT", null);
    }

    private void assertRejected(String amount, String currency, String direction, String account) {
        SepayTransactionValidator.Validation result = validator.validate(
                payment(), "TX-1", amount, "payment " + PAYMENT_ID, account, currency, direction);

        assertThat(result.accepted()).isFalse();
        assertThat(result.reason()).isNotBlank();
    }

    private static Payment payment() {
        return new Payment(PAYMENT_ID, "ORDER-1", "BUYER-1", new BigDecimal("100000"),
                PaymentMethod.VIETQR, PaymentStatus.PENDING, null, Instant.parse("2026-05-19T00:00:00Z"));
    }
}
