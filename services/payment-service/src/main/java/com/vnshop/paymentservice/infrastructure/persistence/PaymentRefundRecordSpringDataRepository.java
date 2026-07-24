package com.vnshop.paymentservice.infrastructure.persistence;

import com.vnshop.paymentservice.domain.PaymentRefundRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.UUID;

interface PaymentRefundRecordSpringDataRepository extends JpaRepository<PaymentRefundRecordJpaEntity, UUID> {
    @Query("select coalesce(sum(r.amount), 0) from PaymentRefundRecordJpaEntity r where r.paymentId = :paymentId and r.status = :status")
    BigDecimal sumByPaymentIdAndStatus(
            @Param("paymentId") UUID paymentId,
            @Param("status") PaymentRefundRecord.RefundStatus status);
}
