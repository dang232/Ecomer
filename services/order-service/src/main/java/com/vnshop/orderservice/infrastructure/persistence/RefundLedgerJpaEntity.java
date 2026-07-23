package com.vnshop.orderservice.infrastructure.persistence;

import com.vnshop.orderservice.domain.RefundLedgerEntry;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(schema = "order_svc", name = "refund_ledger")
@Getter
@Setter
public class RefundLedgerJpaEntity extends BaseJpaEntity {
    @Id
    @Column(name = "refund_id", nullable = false, length = 255)
    private String refundId;

    @Column(name = "order_id", nullable = false, columnDefinition = "uuid")
    private UUID orderId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", referencedColumnName = "id", insertable = false, updatable = false)
    private OrderJpaEntity order;

    @Column(name = "return_id", columnDefinition = "uuid")
    private UUID returnId;

    @Column(name = "seller_id")
    private String sellerId;

    @Column(name = "amount", nullable = false, precision = 19, scale = 2)
    private BigDecimal amount;

    @Column(name = "currency", nullable = false, length = 3)
    private String currency;

    @Column(name = "refunded_at", nullable = false)
    private Instant refundedAt;

    @Column(name = "status", nullable = false, length = 64)
    private String status;

    protected RefundLedgerJpaEntity() {
    }

    static RefundLedgerJpaEntity fromDomain(RefundLedgerEntry entry) {
        RefundLedgerJpaEntity entity = new RefundLedgerJpaEntity();
        entity.refundId = entry.refundId();
        entity.orderId = entry.orderId();
        entity.returnId = entry.returnId();
        entity.sellerId = entry.sellerId();
        entity.amount = entry.amount();
        entity.currency = entry.currency();
        entity.refundedAt = entry.refundedAt();
        entity.status = entry.status();
        return entity;
    }

    RefundLedgerEntry toDomain() {
        return new RefundLedgerEntry(refundId, orderId, returnId, sellerId, amount, currency, refundedAt, status);
    }
}
