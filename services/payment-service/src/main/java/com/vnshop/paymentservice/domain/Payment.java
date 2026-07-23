package com.vnshop.paymentservice.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

public class Payment {
    private final UUID paymentId;
    private final String orderId;
    private final String buyerId;
    private final BigDecimal amount;
    private final PaymentMethod method;
    private final PaymentStatus status;
    private final String transactionRef;
    private final Instant createdAt;
    private final BigDecimal externalAmount;
    private final String externalCurrency;
    private final BigDecimal fxRate;
    private final Instant fxRateAt;
    private final String codCollectionEventId;
    private final Instant codCollectedAt;

    public Payment(UUID paymentId, String orderId, String buyerId, BigDecimal amount, PaymentMethod method, PaymentStatus status, String transactionRef, Instant createdAt) {
        this(paymentId, orderId, buyerId, amount, method, status, transactionRef, createdAt,
                null, null, null, null, null, null);
    }

    public Payment(UUID paymentId, String orderId, String buyerId, BigDecimal amount, PaymentMethod method, PaymentStatus status, String transactionRef, Instant createdAt,
                   BigDecimal externalAmount, String externalCurrency, BigDecimal fxRate, Instant fxRateAt) {
        this(paymentId, orderId, buyerId, amount, method, status, transactionRef, createdAt,
                externalAmount, externalCurrency, fxRate, fxRateAt, null, null);
    }

    public Payment(UUID paymentId, String orderId, String buyerId, BigDecimal amount, PaymentMethod method, PaymentStatus status, String transactionRef, Instant createdAt,
                   BigDecimal externalAmount, String externalCurrency, BigDecimal fxRate, Instant fxRateAt,
                   String codCollectionEventId, Instant codCollectedAt) {
        this.paymentId = Objects.requireNonNull(paymentId, "paymentId is required");
        this.orderId = requireNonBlank(orderId, "orderId");
        this.buyerId = requireNonBlank(buyerId, "buyerId");
        this.amount = Objects.requireNonNull(amount, "amount is required");
        this.method = Objects.requireNonNull(method, "method is required");
        this.status = Objects.requireNonNull(status, "status is required");
        this.transactionRef = transactionRef;
        this.createdAt = Objects.requireNonNull(createdAt, "createdAt is required");
        this.externalAmount = externalAmount;
        this.externalCurrency = externalCurrency;
        this.fxRate = fxRate;
        this.fxRateAt = fxRateAt;
        this.codCollectionEventId = codCollectionEventId;
        this.codCollectedAt = codCollectedAt;
    }

    public static Payment pending(String orderId, String buyerId, BigDecimal amount, PaymentMethod method) {
        return new Payment(UUID.randomUUID(), orderId, buyerId, amount, method, PaymentStatus.PENDING, null, Instant.now());
    }

    public Payment withResult(PaymentStatus status, String transactionRef) {
        return new Payment(paymentId, orderId, buyerId, amount, method, status, transactionRef, createdAt,
                externalAmount, externalCurrency, fxRate, fxRateAt, codCollectionEventId, codCollectedAt);
    }

    public Payment withFxDetails(BigDecimal externalAmount, String externalCurrency, BigDecimal fxRate, Instant fxRateAt) {
        return new Payment(paymentId, orderId, buyerId, amount, method, status, transactionRef, createdAt,
                externalAmount, externalCurrency, fxRate, fxRateAt, codCollectionEventId, codCollectedAt);
    }

    public Payment withCodCollection(String collectionEventId, Instant collectedAt) {
        if (collectionEventId == null || collectionEventId.isBlank()) {
            throw new IllegalArgumentException("collectionEventId is required");
        }
        return new Payment(paymentId, orderId, buyerId, amount, method, status, transactionRef, createdAt,
                externalAmount, externalCurrency, fxRate, fxRateAt, collectionEventId, collectedAt);
    }

    public UUID paymentId() {
        return paymentId;
    }

    public String orderId() {
        return orderId;
    }

    public String buyerId() {
        return buyerId;
    }

    public BigDecimal amount() {
        return amount;
    }

    public PaymentMethod method() {
        return method;
    }

    public PaymentStatus status() {
        return status;
    }

    public String transactionRef() {
        return transactionRef;
    }

    public Instant createdAt() {
        return createdAt;
    }

    public BigDecimal externalAmount() {
        return externalAmount;
    }

    public String externalCurrency() {
        return externalCurrency;
    }

    public BigDecimal fxRate() {
        return fxRate;
    }

    public Instant fxRateAt() {
        return fxRateAt;
    }

    public String codCollectionEventId() {
        return codCollectionEventId;
    }

    public Instant codCollectedAt() {
        return codCollectedAt;
    }

    private static String requireNonBlank(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
        return value;
    }
}
