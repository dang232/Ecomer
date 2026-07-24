package com.vnshop.paymentservice.domain.port.out;

import com.vnshop.paymentservice.domain.PaymentRefundRecord;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

public interface PaymentRefundRepositoryPort {
    Optional<PaymentRefundRecord> findByReversalId(UUID reversalId);

    BigDecimal sumCompletedByPaymentId(UUID paymentId);

    PaymentRefundRecord save(PaymentRefundRecord record);
}
