package com.vnshop.orderservice.infrastructure.persistence;

import com.vnshop.orderservice.domain.finance.FinancialReversal;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(schema = "order_svc", name = "financial_reversals")
public class FinancialReversalJpaEntity extends BaseJpaEntity {
    @Id
    @Column(name = "reversal_row_id", nullable = false)
    private UUID rowId;

    @Column(name = "reversal_id", nullable = false)
    private UUID reversalId;

    @Column(name = "allocation_id", nullable = false)
    private UUID allocationId;

    @Column(name = "order_id", nullable = false)
    private UUID orderId;

    @Enumerated(EnumType.STRING)
    @Column(name = "reversal_type", nullable = false, length = 32)
    private FinancialReversal.ReversalType reversalType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private FinancialReversal.ReversalStatus status;

    @Column(name = "buyer_amount", nullable = false, precision = 19, scale = 0)
    private BigDecimal buyerAmount;

    @Column(name = "currency", nullable = false, length = 3)
    private String currency;

    protected FinancialReversalJpaEntity() {
    }

    static FinancialReversalJpaEntity fromDomain(FinancialReversal reversal) {
        FinancialReversalJpaEntity entity = new FinancialReversalJpaEntity();
        entity.rowId = UUID.randomUUID();
        entity.reversalId = reversal.reversalId();
        entity.allocationId = reversal.allocationId();
        entity.orderId = reversal.orderId();
        entity.reversalType = reversal.reversalType();
        entity.status = reversal.status();
        entity.buyerAmount = reversal.buyerAmount();
        entity.currency = reversal.currency();
        return entity;
    }

    FinancialReversal toDomain() {
        return new FinancialReversal(reversalId, allocationId, orderId, reversalType, status,
                buyerAmount, currency, getCreatedAt(), getUpdatedAt());
    }

    void resolve(FinancialReversal.ReversalStatus nextStatus) {
        if (reversalType != FinancialReversal.ReversalType.CHARGEBACK) {
            throw new IllegalArgumentException("only chargeback reservations can be resolved");
        }
        if (status == nextStatus) return;
        if (status != FinancialReversal.ReversalStatus.OPEN) {
            throw new IllegalStateException("chargeback reservation is already resolved");
        }
        if (nextStatus != FinancialReversal.ReversalStatus.RELEASED
                && nextStatus != FinancialReversal.ReversalStatus.FINALIZED) {
            throw new IllegalArgumentException("chargeback resolution must release or finalize");
        }
        status = nextStatus;
    }
}
