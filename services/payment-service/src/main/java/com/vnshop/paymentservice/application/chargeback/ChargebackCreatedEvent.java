package com.vnshop.paymentservice.application.chargeback;

import com.vnshop.paymentservice.domain.Chargeback;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Wire format for the {@code payment.chargeback.created} Kafka topic.
 * Consumed by order-service to flip the order's status to DISPUTED.
 */
public record ChargebackCreatedEvent(
        UUID chargebackId,
        String orderId,
        String externalChargebackId,
        String provider,
        String reason,
        String status,
        LocalDate dueDate) {

    public static ChargebackCreatedEvent from(Chargeback cb) {
        return new ChargebackCreatedEvent(
                cb.id(),
                cb.orderId(),
                cb.externalChargebackId(),
                cb.provider().name(),
                cb.reason(),
                cb.status().name(),
                cb.dueDate());
    }
}
