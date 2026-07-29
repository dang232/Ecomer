package com.vnshop.paymentservice.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.PaymentMethod;
import com.vnshop.paymentservice.domain.PaymentStatus;
import com.vnshop.paymentservice.domain.port.out.FxRatePort;
import com.vnshop.paymentservice.domain.port.out.PaymentRepositoryPort;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionOperations;

class ProviderInitializationServiceTest {
    @Test
    void freezesTheFirstFxQuoteAndKeepsItForEveryLaterRetry() {
        UUID paymentId = UUID.randomUUID();
        InMemoryPayments payments = new InMemoryPayments(payment(paymentId));
        AtomicReference<BigDecimal> quote = new AtomicReference<>(new BigDecimal("0.00004"));
        ProviderInitializationService service = new ProviderInitializationService(
                payments, (from, to) -> quote.get(), immediateTransactions());

        Payment first = service.freezeExternalAmount(paymentId);
        quote.set(new BigDecimal("0.00005"));
        Payment retry = service.freezeExternalAmount(paymentId);

        assertThat(first.externalAmount()).isEqualByComparingTo("4.00");
        assertThat(first.fxRate()).isEqualByComparingTo("0.00004");
        assertThat(retry.externalAmount()).isEqualByComparingTo("4.00");
        assertThat(retry.fxRate()).isEqualByComparingTo("0.00004");
        assertThat(payments.lockedReads).isEqualTo(2);
    }

    @Test
    void keepsTheFirstProviderReferenceWhenTheSamePaymentIsRetried() {
        UUID paymentId = UUID.randomUUID();
        InMemoryPayments payments = new InMemoryPayments(payment(paymentId));
        ProviderInitializationService service = new ProviderInitializationService(
                payments, (from, to) -> new BigDecimal("0.00004"), immediateTransactions());

        Payment first = service.persistProviderReference(paymentId, "pi_first");
        Payment retry = service.persistProviderReference(paymentId, "pi_second");

        assertThat(first.transactionRef()).isEqualTo("pi_first");
        assertThat(retry.transactionRef()).isEqualTo("pi_first");
    }

    @SuppressWarnings("unchecked")
    private static TransactionOperations immediateTransactions() {
        TransactionOperations transactions = mock(TransactionOperations.class);
        when(transactions.execute(any())).thenAnswer(invocation -> {
            TransactionCallback<Object> callback = invocation.getArgument(0);
            return callback.doInTransaction(new SimpleTransactionStatus());
        });
        return transactions;
    }

    private static Payment payment(UUID paymentId) {
        return new Payment(paymentId, "ORDER-1", "BUYER-1", new BigDecimal("100000"),
                PaymentMethod.STRIPE, PaymentStatus.PENDING, null,
                Instant.parse("2026-07-30T10:00:00Z"));
    }

    private static final class InMemoryPayments implements PaymentRepositoryPort {
        private final Map<UUID, Payment> values = new HashMap<>();
        private int lockedReads;

        private InMemoryPayments(Payment payment) {
            values.put(payment.paymentId(), payment);
        }

        @Override public Payment save(Payment payment) { values.put(payment.paymentId(), payment); return payment; }
        @Override public Optional<Payment> findById(UUID paymentId) { return Optional.ofNullable(values.get(paymentId)); }
        @Override public Optional<Payment> findByIdForUpdate(UUID paymentId) {
            lockedReads++;
            return findById(paymentId);
        }
        @Override public Optional<Payment> findByOrderId(String orderId) { return Optional.empty(); }
        @Override public List<Payment> findByStatus(PaymentStatus status) { return List.of(); }
        @Override public List<Payment> findByMethodAndStatusAndCreatedAtBefore(
                PaymentMethod method, PaymentStatus status, Instant before) { return List.of(); }
    }
}
