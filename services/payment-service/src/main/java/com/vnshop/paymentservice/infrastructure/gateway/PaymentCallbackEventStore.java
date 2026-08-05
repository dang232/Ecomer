package com.vnshop.paymentservice.infrastructure.gateway;

import com.vnshop.paymentservice.infrastructure.persistence.PaymentCallbackEventSpringDataRepository;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Immutable provider-reconciliation evidence. RECEIVED records a successful
 * provider action; PROCESSED is appended only after local promotion commits.
 */
@Service
public class PaymentCallbackEventStore {
    private final PaymentCallbackEventSpringDataRepository events;

    public PaymentCallbackEventStore(PaymentCallbackEventSpringDataRepository events) {
        this.events = Objects.requireNonNull(events, "events is required");
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void append(String provider, UUID paymentId, String correlationKey, String eventStatus) {
        require(provider, "provider");
        Objects.requireNonNull(paymentId, "paymentId is required");
        require(correlationKey, "correlationKey");
        require(eventStatus, "eventStatus");
        events.appendIfAbsent(provider, paymentId, correlationKey, eventStatus);
    }

    private static void require(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(name + " is required");
        }
    }
}
