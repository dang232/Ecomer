package com.vnshop.paymentservice.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
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

    @Test
    void replacesOnlyTheLegacyStripePlaceholderWithTheProviderIntent() {
        UUID paymentId = UUID.randomUUID();
        Payment legacy = payment(paymentId).withResult(PaymentStatus.PENDING, "STRIPE-" + paymentId);
        InMemoryPayments payments = new InMemoryPayments(legacy);
        ProviderInitializationService service = new ProviderInitializationService(
                payments, (from, to) -> new BigDecimal("0.00004"), immediateTransactions());

        Payment result = service.persistProviderReference(paymentId, "pi_real");

        assertThat(result.transactionRef()).isEqualTo("pi_real");
    }

    @Test
    void doesNotReplaceARealStripeIntentWithAnotherIntent() {
        UUID paymentId = UUID.randomUUID();
        Payment existing = payment(paymentId).withResult(PaymentStatus.PENDING, "pi_first");
        InMemoryPayments payments = new InMemoryPayments(existing);
        ProviderInitializationService service = new ProviderInitializationService(
                payments, (from, to) -> new BigDecimal("0.00004"), immediateTransactions());

        Payment result = service.persistProviderReference(paymentId, "pi_second");

        assertThat(result.transactionRef()).isEqualTo("pi_first");
    }

    @Test
    void doesNotBotherFxServiceForNonFxMethods() {
        UUID paymentId = UUID.randomUUID();
        Payment nonFxPayment = payment(paymentId, PaymentMethod.COD);
        InMemoryPayments payments = new InMemoryPayments(nonFxPayment);
        CapturingFxRate fxRates = new CapturingFxRate();
        ProviderInitializationService service = new ProviderInitializationService(
                payments, fxRates, immediateTransactions());

        Payment result = service.freezeExternalAmount(paymentId);

        assertThat(fxRates.calls).isEqualTo(0);
        assertThat(result).isEqualTo(nonFxPayment);
    }

    @Test
    void rejectsNegativeAmount() {
        InMemoryPayments payments = new InMemoryPayments(payment(UUID.randomUUID()));
        ProviderInitializationService service = new ProviderInitializationService(
                payments, (f, t) -> new BigDecimal("0.00004"), immediateTransactions());

        assertThatThrownBy(() -> service.persistProviderReference(payments.values.keySet().iterator().next(), null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsBlankProviderReference() {
        UUID paymentId = UUID.randomUUID();
        InMemoryPayments payments = new InMemoryPayments(payment(paymentId));
        ProviderInitializationService service = new ProviderInitializationService(
                payments, (f, t) -> new BigDecimal("0.00004"), immediateTransactions());

        assertThatThrownBy(() -> service.persistProviderReference(paymentId, "   "))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsPaymentNotFound() {
        InMemoryPayments payments = new InMemoryPayments();
        ProviderInitializationService service = new ProviderInitializationService(
                payments, (f, t) -> new BigDecimal("0.00004"), immediateTransactions());

        assertThatThrownBy(() -> service.freezeExternalAmount(UUID.randomUUID()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private static final class CapturingFxRate implements FxRatePort {
        int calls;

        @Override
        public BigDecimal rate(String from, String to) {
            calls++;
            return new BigDecimal("0.00004");
        }
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
        return payment(paymentId, PaymentMethod.STRIPE);
    }

    private static Payment payment(UUID paymentId, PaymentMethod method) {
        return new Payment(paymentId, "ORDER-1", "BUYER-1", new BigDecimal("100000"),
                method, PaymentStatus.PENDING, null,
                Instant.parse("2026-07-30T10:00:00Z"));
    }

    private static final class InMemoryPayments implements PaymentRepositoryPort {
        private final Map<UUID, Payment> values = new HashMap<>();
        private int lockedReads;

        private InMemoryPayments() {}

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
