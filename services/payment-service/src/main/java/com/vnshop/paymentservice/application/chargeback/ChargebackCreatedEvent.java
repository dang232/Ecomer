package com.vnshop.paymentservice.application.chargeback;

import com.vnshop.paymentservice.domain.Chargeback;

import java.time.LocalDate;
import java.math.BigDecimal;
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
        LocalDate dueDate,
        BigDecimal challengedAmount,
        String currency,
        String providerPaymentId) {

    public ChargebackCreatedEvent(UUID chargebackId, String orderId, String externalChargebackId,
                                  String provider, String reason, String status, LocalDate dueDate) {
        this(chargebackId, orderId, externalChargebackId, provider, reason, status, dueDate, null, "VND", null);
    }

    public static ChargebackCreatedEvent from(Chargeback cb) {
        return new ChargebackCreatedEvent(
                cb.id(),
                cb.orderId(),
                cb.externalChargebackId(),
                cb.provider().name(),
                cb.reason(),
                cb.status().name(),
                cb.dueDate(), cb.challengedAmount(), cb.currency(), cb.providerPaymentId());
    }
}
