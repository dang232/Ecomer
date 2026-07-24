package com.vnshop.paymentservice.application;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Input command for {@link RefundPaymentUseCase}.
 *
 * @param orderId   order to be refunded — used to locate the Payment record
 * @param sagaId    saga correlation id; forwarded to {@code payment.refunded}
 *                  so the order-service SagaCompensationListener can close
 *                  the compensation step
 * @param reason    free-text reason forwarded to the gateway for dispute support
 */
public record RefundPaymentCommand(
        String orderId,
        String sagaId,
        String reason,
        UUID reversalId,
        BigDecimal amount) {

    /** Legacy full-refund command; callers should provide a stable reversal id. */
    public RefundPaymentCommand(String orderId, String sagaId, String reason) {
        this(orderId, sagaId, reason, stableLegacyReversalId(orderId, sagaId), null);
    }

    private static UUID stableLegacyReversalId(String orderId, String sagaId) {
        return UUID.nameUUIDFromBytes((orderId + ":" + (sagaId == null ? "legacy" : sagaId))
                .getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }
}
