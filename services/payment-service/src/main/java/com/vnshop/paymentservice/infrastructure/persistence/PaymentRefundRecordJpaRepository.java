package com.vnshop.paymentservice.infrastructure.persistence;

import com.vnshop.paymentservice.domain.PaymentRefundRecord;
import com.vnshop.paymentservice.domain.port.out.PaymentRefundRepositoryPort;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

@Repository
public class PaymentRefundRecordJpaRepository implements PaymentRefundRepositoryPort {
    private final PaymentRefundRecordSpringDataRepository repository;

    public PaymentRefundRecordJpaRepository(PaymentRefundRecordSpringDataRepository repository) {
        this.repository = repository;
    }

    @Override
    public Optional<PaymentRefundRecord> findByReversalId(UUID reversalId) {
        return repository.findById(reversalId).map(PaymentRefundRecordJpaEntity::toDomain);
    }

    @Override
    public BigDecimal sumCompletedByPaymentId(UUID paymentId) {
        return repository.sumByPaymentIdAndStatus(paymentId, PaymentRefundRecord.RefundStatus.COMPLETED);
    }

    @Override
    public PaymentRefundRecord save(PaymentRefundRecord record) {
        return repository.save(PaymentRefundRecordJpaEntity.fromDomain(record)).toDomain();
    }
}
