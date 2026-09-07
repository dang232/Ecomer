package com.vnshop.orderservice.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

public class Return {
    private final UUID returnId;
    private final String orderId;
    private final Long subOrderId;
    private final String buyerId;
    private final String reason;
    private final Integer returnedQuantity;
    private ReturnStatus status;
    private final Instant requestedAt;
    private Instant resolvedAt;

    public Return(UUID returnId, String orderId, Long subOrderId, String buyerId, String reason) {
        this(returnId, orderId, subOrderId, buyerId, reason, null, ReturnStatus.REQUESTED, Instant.now(), null);
    }

    public Return(UUID returnId, String orderId, Long subOrderId, String buyerId, String reason,
                  int returnedQuantity, ReturnStatus status, Instant requestedAt, Instant resolvedAt) {
        this(returnId, orderId, subOrderId, buyerId, reason, Integer.valueOf(returnedQuantity), status,
                requestedAt, resolvedAt);
    }

    public Return(
            UUID returnId,
            String orderId,
            Long subOrderId,
            String buyerId,
            String reason,
            ReturnStatus status,
            Instant requestedAt,
            Instant resolvedAt
    ) {
        this(returnId, orderId, subOrderId, buyerId, reason, null, status, requestedAt, resolvedAt);
    }

    public Return(
            UUID returnId,
            String orderId,
            Long subOrderId,
            String buyerId,
            String reason,
            Integer returnedQuantity,
            ReturnStatus status,
            Instant requestedAt,
            Instant resolvedAt
    ) {
        Objects.requireNonNull(returnId, "returnId is required");
        requireNonBlank(orderId, "orderId");
        requireNonBlank(buyerId, "buyerId");
        requireNonBlank(reason, "reason");
        if (returnedQuantity != null && returnedQuantity <= 0) {
            throw new IllegalArgumentException("returnedQuantity must be positive");
        }
        this.returnId = returnId;
        this.orderId = orderId;
        this.subOrderId = Objects.requireNonNull(subOrderId, "subOrderId is required");
        this.buyerId = buyerId;
        this.reason = reason;
        this.returnedQuantity = returnedQuantity;
        this.status = Objects.requireNonNull(status, "status is required");
        this.requestedAt = Objects.requireNonNull(requestedAt, "requestedAt is required");
        this.resolvedAt = resolvedAt;
    }

    public UUID returnId() {
        return returnId;
    }

    public String orderId() {
        return orderId;
    }

    public Long subOrderId() {
        return subOrderId;
    }

    public String buyerId() {
        return buyerId;
    }

    public String reason() {
        return reason;
    }

    public Integer returnedQuantity() {
        return returnedQuantity;
    }

    public ReturnStatus status() {
        return status;
    }

    public Instant requestedAt() {
        return requestedAt;
    }

    public Instant resolvedAt() {
        return resolvedAt;
    }

    public void approve() {
        if (status != ReturnStatus.REQUESTED) {
            throw new IllegalStateException("cannot approve return from " + status);
        }
        status = ReturnStatus.APPROVED;
        resolvedAt = Instant.now();
    }

    public void reject() {
        if (status != ReturnStatus.REQUESTED) {
            throw new IllegalStateException("cannot reject return from " + status);
        }
        status = ReturnStatus.REJECTED;
        resolvedAt = Instant.now();
    }

    public void complete() {
        if (status != ReturnStatus.APPROVED) {
            throw new IllegalStateException("cannot complete return from " + status);
        }
        status = ReturnStatus.COMPLETED;
        resolvedAt = Instant.now();
    }

    public void markRefunded() {
        if (status == ReturnStatus.REFUNDED) {
            return;
        }
        if (status != ReturnStatus.COMPLETED) {
            throw new IllegalStateException("cannot mark refunded from " + status);
        }
        status = ReturnStatus.REFUNDED;
        resolvedAt = Instant.now();
    }

    private static void requireNonBlank(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
    }
}
