package com.vnshop.paymentservice.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.UUID;

/**
 * Represents a payment-provider chargeback (card dispute initiated by the
 * buyer's bank). Separate from the return-based {@code Dispute} in order-service;
 * these are created by provider webhooks and managed via the admin counter-evidence API.
 */
public record Chargeback(
        UUID id,
        String orderId,
        String externalChargebackId,
        ChargebackProvider provider,
        String reason,
        ChargebackStatus status,
        String evidenceJson,
        LocalDate dueDate,
        BigDecimal challengedAmount,
        String currency,
        String providerPaymentId,
        Instant createdAt,
        Instant updatedAt) {

    public enum ChargebackProvider {
        STRIPE, PAYPAL, VNPAY, MOMO
    }

    public enum ChargebackStatus {
        OPEN, WON, LOST, ACCEPTED
    }

    public Chargeback withStatus(ChargebackStatus newStatus) {
        return new Chargeback(id, orderId, externalChargebackId, provider, reason,
                newStatus, evidenceJson, dueDate, challengedAmount, currency, providerPaymentId, createdAt, updatedAt);
    }

    public Chargeback withEvidence(String json) {
        return new Chargeback(id, orderId, externalChargebackId, provider, reason,
                status, json, dueDate, challengedAmount, currency, providerPaymentId, createdAt, updatedAt);
    }

    public Chargeback(UUID id, String orderId, String externalChargebackId, ChargebackProvider provider,
                      String reason, ChargebackStatus status, String evidenceJson, LocalDate dueDate,
                      Instant createdAt, Instant updatedAt) {
        this(id, orderId, externalChargebackId, provider, reason, status, evidenceJson, dueDate,
                null, "VND", null, createdAt, updatedAt);
    }
}
