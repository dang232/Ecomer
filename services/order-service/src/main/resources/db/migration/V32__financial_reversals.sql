CREATE TABLE order_svc.financial_reversals (
    reversal_row_id UUID PRIMARY KEY,
    reversal_id UUID NOT NULL,
    allocation_id UUID NOT NULL,
    order_id UUID NOT NULL,
    reversal_type VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    buyer_amount NUMERIC(19, 0) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_financial_reversals_operation_allocation UNIQUE (reversal_id, allocation_id),
    CONSTRAINT fk_financial_reversals_allocation
        FOREIGN KEY (allocation_id) REFERENCES order_svc.sub_order_financial_allocations (allocation_id),
    CONSTRAINT chk_financial_reversals_type CHECK (reversal_type IN ('REFUND', 'CHARGEBACK')),
    CONSTRAINT chk_financial_reversals_status CHECK (status IN ('OPEN', 'FINALIZED', 'RELEASED')),
    CONSTRAINT chk_financial_reversals_amount_positive CHECK (buyer_amount > 0),
    CONSTRAINT chk_financial_reversals_currency CHECK (currency = 'VND')
);

CREATE INDEX idx_financial_reversals_allocation_status
    ON order_svc.financial_reversals (allocation_id, status);
CREATE INDEX idx_financial_reversals_operation
    ON order_svc.financial_reversals (reversal_id);
