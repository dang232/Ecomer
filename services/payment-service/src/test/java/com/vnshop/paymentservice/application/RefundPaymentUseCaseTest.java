package com.vnshop.paymentservice.application;

import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.PaymentMethod;
import com.vnshop.paymentservice.domain.PaymentRefundRecord;
import com.vnshop.paymentservice.domain.PaymentStatus;
import com.vnshop.paymentservice.domain.port.out.PaymentRepositoryPort;
import com.vnshop.paymentservice.domain.port.out.PaymentRefundRepositoryPort;
import com.vnshop.paymentservice.domain.port.out.RefundGatewayPort;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RefundPaymentUseCaseTest {

    @Test
    void partialRefundsUseStableReversalIdsAndReachRefundedOnlyAtTheCapturedTotal() {
        Payment payment = new Payment(UUID.randomUUID(), "order-1", "buyer-1", amount("100"),
                PaymentMethod.STRIPE, PaymentStatus.COMPLETED, "pi-1", Instant.now());
        Payments payments = new Payments(payment);
        Refunds refunds = new Refunds();
        Gateway gateway = new Gateway();
        RefundPaymentUseCase useCase = new RefundPaymentUseCase(payments, List.of(gateway), refunds);

        UUID firstReversal = UUID.randomUUID();
        UUID secondReversal = UUID.randomUUID();
        RefundPaymentUseCase.RefundResult first = useCase.refund(
                new RefundPaymentCommand("order-1", "saga-1", "return", firstReversal, amount("40")));
        RefundPaymentUseCase.RefundResult second = useCase.refund(
                new RefundPaymentCommand("order-1", "saga-1", "return", secondReversal, amount("60")));

        assertThat(first.amount()).isEqualByComparingTo("40");
        assertThat(second.amount()).isEqualByComparingTo("60");
        assertThat(payments.current.status()).isEqualTo(PaymentStatus.REFUNDED);
        assertThat(gateway.reversalIds).containsExactly(firstReversal.toString(), secondReversal.toString());
        assertThatThrownBy(() -> useCase.refund(new RefundPaymentCommand(
                "order-1", "saga-1", "too much", UUID.randomUUID(), amount("1"))))
                .isInstanceOf(PaymentNotRefundableException.class);
    }

    @Test
    void replayOfAReversalDoesNotCallTheProviderAgain() {
        Payment payment = new Payment(UUID.randomUUID(), "order-1", "buyer-1", amount("100"),
                PaymentMethod.STRIPE, PaymentStatus.COMPLETED, "pi-1", Instant.now());
        Payments payments = new Payments(payment);
        Refunds refunds = new Refunds();
        Gateway gateway = new Gateway();
        RefundPaymentUseCase useCase = new RefundPaymentUseCase(payments, List.of(gateway), refunds);
        UUID reversalId = UUID.randomUUID();
        RefundPaymentCommand command = new RefundPaymentCommand("order-1", "saga-1", "return", reversalId, amount("25"));

        useCase.refund(command);
        useCase.refund(command);

        assertThat(gateway.calls).isEqualTo(1);
        assertThat(refunds.records).hasSize(1);
    }

    private static BigDecimal amount(String value) { return new BigDecimal(value); }

    private static final class Gateway implements RefundGatewayPort {
        int calls;
        final List<String> reversalIds = new ArrayList<>();

        @Override public boolean supports(String paymentMethod) { return true; }

        @Override public String refund(String paymentId, String transactionRef, BigDecimal amount, String reason) {
            calls++;
            return "provider-" + calls;
        }

        @Override public String refund(String paymentId, String transactionRef, BigDecimal amount, String reason, String reversalId) {
            calls++;
            reversalIds.add(reversalId);
            return "provider-" + calls;
        }
    }

    private static final class Payments implements PaymentRepositoryPort {
        Payment current;
        Payments(Payment current) { this.current = current; }
        @Override public Payment save(Payment payment) { current = payment; return payment; }
        @Override public Optional<Payment> findById(UUID paymentId) { return Optional.of(current); }
        @Override public Optional<Payment> findByOrderId(String orderId) { return Optional.of(current); }
        @Override public Optional<Payment> findByOrderIdForUpdate(String orderId) { return Optional.of(current); }
        @Override public List<Payment> findByStatus(PaymentStatus status) { return List.of(); }
        @Override public List<Payment> findByMethodAndStatusAndCreatedAtBefore(PaymentMethod method, PaymentStatus status, Instant before) { return List.of(); }
    }

    private static final class Refunds implements PaymentRefundRepositoryPort {
        final List<PaymentRefundRecord> records = new ArrayList<>();
        @Override public Optional<PaymentRefundRecord> findByReversalId(UUID reversalId) {
            return records.stream().filter(record -> record.reversalId().equals(reversalId)).findFirst();
        }
        @Override public BigDecimal sumCompletedByPaymentId(UUID paymentId) {
            return records.stream().filter(record -> record.paymentId().equals(paymentId))
                    .map(PaymentRefundRecord::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
        }
        @Override public PaymentRefundRecord save(PaymentRefundRecord record) { records.add(record); return record; }
    }
}
