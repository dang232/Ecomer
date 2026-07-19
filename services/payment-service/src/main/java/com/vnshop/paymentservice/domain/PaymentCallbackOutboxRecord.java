package com.vnshop.paymentservice.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record PaymentCallbackOutboxRecord(
        Long id,
        String provider,
        UUID paymentId,
        String orderId,
        String transactionRef,
        String status,
        BigDecimal amount,
        String currency,
        UUID callbackId,
        String callbackEventId,
        String payloadHash,
        Instant createdAt,
        Instant publishedAt,
        BigDecimal externalAmount,
        String externalCurrency,
        BigDecimal fxRate,
        Instant fxRateAt,
        int attemptCount
) {
    public static PaymentCallbackOutboxRecord pending(
            String provider, UUID paymentId, String orderId, String transactionRef,
            String status, BigDecimal amount, UUID callbackId, String callbackEventId,
            String payloadHash,
            BigDecimal externalAmount, String externalCurrency, BigDecimal fxRate, Instant fxRateAt) {
        return new PaymentCallbackOutboxRecord(
                null, provider, paymentId, orderId, transactionRef, status, amount, "VND",
                callbackId, callbackEventId, payloadHash, Instant.now(), null,
                externalAmount, externalCurrency, fxRate, fxRateAt, 0);
    }
}
