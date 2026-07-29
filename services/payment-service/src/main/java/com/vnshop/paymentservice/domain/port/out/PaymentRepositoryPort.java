package com.vnshop.paymentservice.domain.port.out;

import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.PaymentMethod;
import com.vnshop.paymentservice.domain.PaymentStatus;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PaymentRepositoryPort {
    Payment save(Payment payment);

    Optional<Payment> findById(UUID paymentId);

    /**
     * Loads one payment under a write lock for state transitions and durable
     * provider initialization. In-memory adapters may use the ordinary lookup;
     * the JPA adapter serializes writers by internal payment id.
     */
    default Optional<Payment> findByIdForUpdate(UUID paymentId) {
        return findById(paymentId);
    }

    Optional<Payment> findByOrderId(String orderId);

    /**
     * Loads the payment under a write lock for state transitions driven by
     * externally delivered evidence. In-memory adapters may use the ordinary
     * lookup; the JPA adapter overrides this with a pessimistic lock.
     */
    default Optional<Payment> findByOrderIdForUpdate(String orderId) {
        return findByOrderId(orderId);
    }

    List<Payment> findByStatus(PaymentStatus status);

    List<Payment> findByMethodAndStatusAndCreatedAtBefore(PaymentMethod method, PaymentStatus status, Instant before);
}
