package com.vnshop.paymentservice.infrastructure.event;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Wire format for the {@code payment.refunded} Kafka topic. Emitted after a
 * successful gateway refund call so the order-service / seller-finance
 * consumers can mark the return as refunded and reverse the wallet credit.
 *
 * <p>{@code amount}/{@code currency} are the buyer-facing VND figures the
 * order-service ledger needs. {@code refundId} + {@code captureId} are the
 * PayPal references for dispute support.
 */
public record PaymentRefundedEvent(
        String provider,
        UUID paymentId,
        String orderId,
        String returnId,
        String sellerId,
        String refundId,
        String captureId,
        String status,
        BigDecimal amount,
        String currency,
        String commissionTier,
        String sagaId,
        String reversalId) {

    public PaymentRefundedEvent(
            String provider, UUID paymentId, String orderId, String returnId, String sellerId,
            String refundId, String captureId, String status, BigDecimal amount, String currency,
            String commissionTier, String sagaId) {
        this(provider, paymentId, orderId, returnId, sellerId, refundId, captureId, status,
                amount, currency, commissionTier, sagaId, refundId);
    }
}
