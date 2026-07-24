package com.vnshop.paymentservice.infrastructure.persistence;

import com.vnshop.paymentservice.domain.PaymentRefundRecord;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(schema = "payment_svc", name = "payment_refund_records")
@Getter
@Setter
public class PaymentRefundRecordJpaEntity {
    @Id
    @Column(name = "refund_id", nullable = false, columnDefinition = "uuid")
    private UUID reversalId;

    @Column(name = "payment_id", nullable = false, columnDefinition = "uuid")
    private UUID paymentId;

    @Column(name = "provider_ref", nullable = false, length = 1024)
    private String providerRef;

    @Column(name = "amount", nullable = false, precision = 19, scale = 2)
    private BigDecimal amount;

    @Column(name = "currency", nullable = false, length = 3)
    private String currency;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private PaymentRefundRecord.RefundStatus status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected PaymentRefundRecordJpaEntity() {
    }

    static PaymentRefundRecordJpaEntity fromDomain(PaymentRefundRecord record) {
        PaymentRefundRecordJpaEntity entity = new PaymentRefundRecordJpaEntity();
        entity.reversalId = record.reversalId();
        entity.paymentId = record.paymentId();
        entity.providerRef = record.providerRef();
        entity.amount = record.amount();
        entity.currency = record.currency();
        entity.status = record.status();
        entity.createdAt = record.createdAt();
        entity.updatedAt = record.updatedAt();
        return entity;
    }

    PaymentRefundRecord toDomain() {
        return new PaymentRefundRecord(reversalId, paymentId, providerRef, amount, currency, status, createdAt, updatedAt);
    }
}
